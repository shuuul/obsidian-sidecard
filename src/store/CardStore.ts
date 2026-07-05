import { Notice, Plugin, TAbstractFile, TFile } from 'obsidian';
import { createDefaultData, normalizeData } from '../defaults';
import type { CardInstance, CardLibraryPluginData, CardLibrarySettings, CardLibraryState } from '../types';
import { createCardId } from '../utils/cards';
import { getSourceType } from '../utils/files';

export class CardStore {
  private data: CardLibraryPluginData = createDefaultData();
  private listeners = new Set<() => void>();
  private saveTimer: number | null = null;

  constructor(private plugin: Plugin) {}

  async load(): Promise<void> {
    this.data = normalizeData(await this.plugin.loadData());
    this.refreshMissingFlags();
  }

  async save(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  saveDebounced(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, this.data.settings.resizeSaveDebounceMs);
  }

  flushDebouncedSave(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    void this.save();
  }

  getState(): CardLibraryState {
    return this.data.state;
  }

  getSettings(): CardLibrarySettings {
    return this.data.settings;
  }

  updateSettings(patch: Partial<CardLibrarySettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.emit(true);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  addFileAsNewCard(file: TFile, seed: Partial<CardInstance> = {}): CardInstance {
    const now = Date.now();
    const card: CardInstance = {
      id: createCardId(),
      source: { type: getSourceType(file), path: file.path },
      title: file.basename,
      userTitle: seed.userTitle,
      instanceLabel: this.nextInstanceLabel(file.path),
      collapsed: seed.collapsed ?? this.data.settings.defaultCollapsed,
      pinned: seed.pinned ?? false,
      missing: false,
      heightMode: seed.heightMode ?? 'custom',
      heightPx: seed.heightPx ?? this.data.settings.defaultCardHeightPx,
      minHeightPx: seed.minHeightPx,
      maxHeightPx: seed.maxHeightPx,
      manualOrder: this.nextManualOrder(),
      pinOrder: null,
      createdAt: now,
      updatedAt: now,
      lastViewedAt: now,
      markdownState: seed.markdownState,
      pdfState: seed.pdfState,
    };

    this.data.state.cards.push(card);
    this.data.state.activeCardId = card.id;
    this.enforceExpandedLimit();
    this.emit(true);
    return card;
  }

  duplicateCard(cardId: string): CardInstance | null {
    const original = this.getCard(cardId);
    if (!original) return null;
    const file = this.getSourceFile(original);
    if (!file) {
      new Notice('Source file is missing.');
      return null;
    }
    return this.addFileAsNewCard(file, {
      userTitle: original.userTitle ? `${original.userTitle} copy` : undefined,
      collapsed: original.collapsed,
      pinned: original.pinned,
      heightMode: original.heightMode,
      heightPx: original.heightPx,
      markdownState: { ...original.markdownState },
      pdfState: { ...original.pdfState },
    });
  }

  patchCard(cardId: string, patch: Partial<CardInstance>): void {
    const card = this.getCard(cardId);
    if (!card) return;
    Object.assign(card, patch, { updatedAt: Date.now() });
    this.emit(true);
  }

  patchCardDebounced(cardId: string, patch: Partial<CardInstance>): void {
    const card = this.getCard(cardId);
    if (!card) return;
    Object.assign(card, patch, { updatedAt: Date.now() });
    this.saveDebounced();
  }

  removeCard(cardId: string): void {
    this.data.state.cards = this.data.state.cards.filter((card) => card.id !== cardId);
    if (this.data.state.activeCardId === cardId) this.data.state.activeCardId = undefined;
    this.emit(true);
  }

  clearUnpinned(): void {
    this.data.state.cards = this.data.state.cards.filter((card) => card.pinned);
    this.emit(true);
  }

  clearMissing(): void {
    this.data.state.cards = this.data.state.cards.filter((card) => !card.missing);
    this.emit(true);
  }

  togglePinned(cardId: string): void {
    const card = this.getCard(cardId);
    if (!card) return;
    card.pinned = !card.pinned;
    card.pinOrder = null;
    card.updatedAt = Date.now();
    this.emit(true);
  }

  moveCard(draggedCardId: string, targetCardId: string, placement: 'before' | 'after'): void {
    if (draggedCardId === targetCardId) return;

    const cards = [...this.data.state.cards].sort((a, b) => a.manualOrder - b.manualOrder);
    const draggedIndex = cards.findIndex((card) => card.id === draggedCardId);
    const targetIndex = cards.findIndex((card) => card.id === targetCardId);
    if (draggedIndex < 0 || targetIndex < 0) return;

    const [draggedCard] = cards.splice(draggedIndex, 1);
    const adjustedTargetIndex = cards.findIndex((card) => card.id === targetCardId);
    cards.splice(placement === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1, 0, draggedCard);
    cards.forEach((card, index) => {
      card.manualOrder = index + 1;
      card.updatedAt = Date.now();
    });
    this.emit(true);
  }

  reorderCards(cardIds: string[]): void {
    const cardById = new Map(this.data.state.cards.map((card) => [card.id, card]));
    let order = 1;
    let changed = false;

    for (const cardId of cardIds) {
      const card = cardById.get(cardId);
      if (!card) continue;
      if (card.manualOrder !== order) changed = true;
      card.manualOrder = order;
      card.updatedAt = Date.now();
      order += 1;
    }

    const remainingCards = this.data.state.cards
      .filter((card) => !cardIds.includes(card.id))
      .sort((a, b) => a.manualOrder - b.manualOrder);
    for (const card of remainingCards) {
      if (card.manualOrder !== order) changed = true;
      card.manualOrder = order;
      order += 1;
    }

    if (changed) this.emit(true);
  }

  toggleCollapsed(cardId: string): void {
    const card = this.getCard(cardId);
    if (!card) return;
    card.collapsed = !card.collapsed;
    card.lastViewedAt = Date.now();
    card.updatedAt = Date.now();
    this.enforceExpandedLimit(card.id);
    this.emit(true);
  }

  handleFileRenamed(file: TAbstractFile, oldPath: string): void {
    if (!(file instanceof TFile)) return;
    let changed = false;
    for (const card of this.data.state.cards) {
      if (card.source.path !== oldPath) continue;
      card.source.path = file.path;
      card.source.type = getSourceType(file);
      card.title = file.basename;
      card.missing = false;
      card.updatedAt = Date.now();
      changed = true;
    }
    if (changed) this.emit(true);
  }

  handleFileDeleted(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    let changed = false;
    for (const card of this.data.state.cards) {
      if (card.source.path !== file.path) continue;
      card.missing = true;
      card.updatedAt = Date.now();
      changed = true;
    }
    if (changed) this.emit(true);
  }

  handleFileModified(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (this.data.state.cards.some((card) => card.source.path === file.path)) {
      this.listeners.forEach((listener) => listener());
    }
  }

  getSourceFile(card: CardInstance): TFile | null {
    const file = this.plugin.app.vault.getAbstractFileByPath(card.source.path);
    return file instanceof TFile ? file : null;
  }

  getCardById(cardId: string): CardInstance | undefined {
    return this.getCard(cardId);
  }

  private getCard(cardId: string): CardInstance | undefined {
    return this.data.state.cards.find((card) => card.id === cardId);
  }

  private nextInstanceLabel(path: string): string | undefined {
    const count = this.data.state.cards.filter((card) => card.source.path === path).length + 1;
    return count > 1 ? String(count) : undefined;
  }

  private nextManualOrder(): number {
    return Math.max(0, ...this.data.state.cards.map((card) => card.manualOrder)) + 1;
  }

  private enforceExpandedLimit(activeCardId?: string): void {
    const { maxExpandedCards, protectPinnedExpansion } = this.data.settings;
    if (maxExpandedCards <= 0) return;

    const expanded = this.data.state.cards
      .filter((card) => !card.collapsed)
      .sort((a, b) => (a.lastViewedAt ?? a.updatedAt) - (b.lastViewedAt ?? b.updatedAt));

    while (expanded.length > maxExpandedCards) {
      const index = expanded.findIndex((card) => card.id !== activeCardId && (!protectPinnedExpansion || !card.pinned));
      if (index < 0) return;
      const [card] = expanded.splice(index, 1);
      card.collapsed = true;
      card.updatedAt = Date.now();
    }
  }

  private refreshMissingFlags(): void {
    for (const card of this.data.state.cards) {
      card.missing = !(this.plugin.app.vault.getAbstractFileByPath(card.source.path) instanceof TFile);
    }
  }

  private emit(shouldSave: boolean): void {
    this.listeners.forEach((listener) => listener());
    if (shouldSave) void this.save();
  }
}
