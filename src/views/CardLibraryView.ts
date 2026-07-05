import { ItemView, MarkdownRenderer, MarkdownView, Notice, setIcon, TFile, WorkspaceLeaf } from 'obsidian';
import Sortable from 'sortablejs';
import { CARD_LIBRARY_DRAG_MIME, CARD_LIBRARY_PATH_MIME, VIEW_TYPE_CARD_LIBRARY } from '../constants';
import type CardLibraryPlugin from '../main';
import type { CardInstance } from '../types';
import { clamp, getCardDisplayTitle, sortCardsForRender } from '../utils/cards';
import { isSupportedFile } from '../utils/files';

interface DraggedCardPayload {
  cardId: string;
  path: string;
}

interface DraggedWorkspaceTab {
  file: TFile;
  leaf: WorkspaceLeaf | null;
  startedAt: number;
}

export class CardLibraryView extends ItemView {
  private unsubscribe?: () => void;
  private rootEl?: HTMLElement;
  private searchRequestId = 0;
  private visibleSearchResults: TFile[] = [];
  private draggedWorkspaceTab: DraggedWorkspaceTab | null = null;
  private sortables: Sortable[] = [];
  private isSortingCards = false;
  private ignoreInternalSortDropsUntil = 0;

  private readonly handleDocumentDragOver = (event: DragEvent) => {
    if (this.contentEl.contains(event.target as Node) && this.getDraggedWorkspaceTabFile()) {
      this.claimDragEvent(event);
      this.rootEl?.addClass('is-drop-target');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      return;
    }

    if (!event.dataTransfer?.types.includes(CARD_LIBRARY_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = this.contentEl.contains(event.target as Node) ? 'copy' : 'move';
  };

  private readonly handleDocumentDrop = (event: DragEvent) => {
    if (this.contentEl.contains(event.target as Node) && this.getDraggedWorkspaceTabFile()) return;

    const payload = this.getDraggedCardPayload(event.dataTransfer);
    if (!payload || this.contentEl.contains(event.target as Node)) {
      this.clearDraggedWorkspaceTabSoon();
      return;
    }
    event.preventDefault();
    void this.openDraggedCardInEditor(payload);
    this.clearDraggedWorkspaceTabSoon();
  };

  private readonly handleDocumentDragStart = (event: DragEvent) => {
    if (this.contentEl.contains(event.target as Node)) return;
    if (!this.isWorkspaceTabHeaderDrag(event)) return;

    const file = this.app.workspace.getActiveFile();
    if (!file || !isSupportedFile(file)) return;
    this.draggedWorkspaceTab = {
      file,
      leaf: this.app.workspace.getLeaf(false),
      startedAt: Date.now(),
    };
  };

  constructor(leaf: WorkspaceLeaf, private plugin: CardLibraryPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CARD_LIBRARY;
  }

  getDisplayText(): string {
    return 'SideCard';
  }

  getIcon(): string {
    return 'library';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('card-library-view');
    this.rootEl = this.contentEl.createDiv({ cls: 'card-library-root' });
    this.rootEl.addEventListener('dragover', this.handleSidebarDragOver, true);
    this.rootEl.addEventListener('dragleave', this.handleSidebarDragLeave, true);
    this.rootEl.addEventListener('drop', this.handleSidebarDrop, true);
    activeDocument.addEventListener('dragstart', this.handleDocumentDragStart, true);
    activeDocument.addEventListener('dragover', this.handleDocumentDragOver, true);
    activeDocument.addEventListener('drop', this.handleDocumentDrop, true);
    this.unsubscribe = this.plugin.store.subscribe(() => this.render());
    this.render();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.destroySortables();
    this.rootEl?.removeEventListener('dragover', this.handleSidebarDragOver, true);
    this.rootEl?.removeEventListener('dragleave', this.handleSidebarDragLeave, true);
    this.rootEl?.removeEventListener('drop', this.handleSidebarDrop, true);
    activeDocument.removeEventListener('dragstart', this.handleDocumentDragStart, true);
    activeDocument.removeEventListener('dragover', this.handleDocumentDragOver, true);
    activeDocument.removeEventListener('drop', this.handleDocumentDrop, true);
    this.contentEl.empty();
  }

  private render(): void {
    if (!this.rootEl) return;
    const scrollTop = this.rootEl.scrollTop;
    this.destroySortables();
    this.rootEl.empty();
    this.renderToolbar(this.rootEl);

    const cards = sortCardsForRender(this.plugin.store.getState().cards);
    if (cards.length === 0) {
      this.rootEl.createDiv({ cls: 'card-library-empty' });
    } else {
      this.renderSection(this.rootEl, cards);
    }
    this.rootEl.scrollTop = scrollTop;
  }

  private renderToolbar(parentEl: HTMLElement): void {
    const toolbar = parentEl.createDiv({ cls: 'card-library-toolbar' });

    const searchEl = toolbar.createEl('input', {
      cls: 'card-library-search-input',
      attr: {
        type: 'search',
        placeholder: 'Search Markdown, PDF, or image files…',
      },
    });
    searchEl.value = this.plugin.store.getState().lastSearchQuery ?? '';

    const resultsEl = toolbar.createDiv({ cls: 'card-library-search-results' });
    const updateResults = () => void this.renderSearchResults(resultsEl, searchEl);

    searchEl.addEventListener('focus', updateResults);
    searchEl.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (toolbar.contains(activeDocument.activeElement)) return;
        this.visibleSearchResults = [];
        resultsEl.empty();
      }, 0);
    });

    searchEl.addEventListener('input', () => {
      this.plugin.store.getState().lastSearchQuery = searchEl.value;
      updateResults();
    });
    searchEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const firstResult = this.visibleSearchResults[0];
      if (!firstResult) return;
      this.plugin.store.addFileAsNewCard(firstResult);
      searchEl.value = '';
      this.plugin.store.getState().lastSearchQuery = '';
      updateResults();
    });

    if (searchEl.value.trim()) updateResults();
  }

  private getRecentFiles(): TFile[] {
    return this.app.workspace.getLastOpenFiles()
      .map((path) => this.app.vault.getAbstractFileByPath(path))
      .filter((file): file is TFile => file instanceof TFile && isSupportedFile(file))
      .slice(0, 8);
  }

  private getTitleSearchText(file: TFile): string {
    const cache = file.extension === 'md' ? this.app.metadataCache.getFileCache(file) : null;
    const frontmatter = cache?.frontmatter;
    const aliases = Array.isArray(frontmatter?.aliases) ? frontmatter.aliases.join(' ') : String(frontmatter?.aliases ?? '');
    const title = String(frontmatter?.title ?? '');
    const tags = (cache?.tags ?? []).map((tag) => tag.tag).join(' ');
    return `${file.basename} ${title} ${aliases} ${file.path} ${tags}`.toLowerCase();
  }

  private async getSearchResults(query: string): Promise<TFile[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return this.getRecentFiles();

    const titleMatches: TFile[] = [];
    const contentMatches: TFile[] = [];
    const files = this.app.vault.getFiles().filter(isSupportedFile);

    for (const file of files) {
      if (this.getTitleSearchText(file).includes(normalized)) titleMatches.push(file);
    }

    if (titleMatches.length >= 8) return titleMatches.slice(0, 8);

    for (const file of files) {
      if (titleMatches.includes(file) || file.extension !== 'md') continue;
      try {
        const content = await this.app.vault.cachedRead(file);
        if (content.toLowerCase().includes(normalized)) contentMatches.push(file);
      } catch (error) {
        console.error('SideCard search failed to read file', file.path, error);
      }
      if (titleMatches.length + contentMatches.length >= 8) break;
    }

    return [...titleMatches, ...contentMatches].slice(0, 8);
  }

  private async renderSearchResults(parentEl: HTMLElement, inputEl: HTMLInputElement): Promise<void> {
    const requestId = ++this.searchRequestId;
    const query = inputEl.value;
    const results = await this.getSearchResults(query);
    if (requestId !== this.searchRequestId) return;

    this.visibleSearchResults = results;
    parentEl.empty();
    for (const file of results) {
      const resultEl = parentEl.createEl('button', { cls: 'card-library-search-result' });
      resultEl.createSpan({ cls: 'card-library-search-result-name', text: file.basename });
      resultEl.createSpan({ cls: 'card-library-search-result-path', text: file.path });
      resultEl.addEventListener('mousedown', (event) => event.preventDefault());
      resultEl.addEventListener('click', () => {
        this.plugin.store.addFileAsNewCard(file);
        this.plugin.store.getState().lastSearchQuery = '';
        inputEl.value = '';
        this.visibleSearchResults = [];
        parentEl.empty();
      });
    }
  }

  private renderSection(parentEl: HTMLElement, cards: CardInstance[]): void {
    if (cards.length === 0) return;
    const stack = parentEl.createDiv({ cls: 'card-library-card-stack' });
    for (const card of cards) this.renderCard(stack, card);
    this.sortables.push(Sortable.create(stack, {
      animation: 150,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      handle: '.card-library-card-drag-handle',
      draggable: '.card-library-card',
      ghostClass: 'is-sortable-ghost',
      chosenClass: 'is-sortable-chosen',
      dragClass: 'is-sortable-drag',
      filter: 'button, input, textarea, select, a, iframe',
      preventOnFilter: false,
      onStart: () => {
        this.isSortingCards = true;
        this.ignoreInternalSortDropsUntil = Date.now() + 1_000;
      },
      onEnd: () => {
        this.ignoreInternalSortDropsUntil = Date.now() + 1_000;
        const cardIds = Array.from(stack.querySelectorAll<HTMLElement>('.card-library-card'))
          .map((cardEl) => cardEl.dataset.cardId)
          .filter((cardId): cardId is string => !!cardId);
        window.setTimeout(() => {
          this.plugin.store.reorderCards(cardIds);
          this.isSortingCards = false;
        }, 0);
      },
      onChoose: () => {
        this.isSortingCards = true;
        this.ignoreInternalSortDropsUntil = Date.now() + 1_000;
      },
      onUnchoose: () => {
        this.ignoreInternalSortDropsUntil = Date.now() + 1_000;
        window.setTimeout(() => {
          this.isSortingCards = false;
        }, 300);
      },
    }));
  }

  private renderCard(parentEl: HTMLElement, card: CardInstance): void {
    const cardEl = parentEl.createDiv({ cls: `card-library-card ${card.pinned ? 'is-pinned' : ''} ${card.missing ? 'is-missing' : ''}` });
    cardEl.dataset.cardId = card.id;

    const header = cardEl.createDiv({ cls: 'card-library-card-header' });

    const dragHandle = header.createSpan({ cls: 'card-library-card-drag-handle', attr: { title: 'Drag to reorder' } });
    setIcon(dragHandle, 'grip-vertical');

    const toggleButton = header.createEl('button', {
      cls: 'card-library-card-toggle',
      attr: { 'aria-label': card.collapsed ? 'Expand card' : 'Collapse card' },
    });
    setIcon(toggleButton, card.collapsed ? 'chevron-right' : 'chevron-down');
    toggleButton.addEventListener('click', () => this.plugin.store.toggleCollapsed(card.id));

    const titleEl = header.createDiv({ cls: 'card-library-card-title' });
    const cardIconEl = titleEl.createSpan({ cls: 'card-library-card-type', attr: { title: this.getCardTypeLabel(card) } });
    setIcon(cardIconEl, 'panel-top');
    titleEl.createSpan({ cls: 'card-library-card-name', text: getCardDisplayTitle(card) });

    const headerActions = header.createDiv({ cls: 'card-library-card-actions' });
    this.addIconButton(headerActions, card.pinned ? 'Unpin' : 'Pin', card.pinned ? 'pin-off' : 'pin', () => this.plugin.store.togglePinned(card.id));
    this.addIconButton(headerActions, 'Insert reference', 'corner-down-left', () => this.insertReference(card));
    this.addIconButton(headerActions, 'Open source', 'external-link', () => void this.openSource(card));
    this.addIconButton(headerActions, 'Duplicate card', 'copy', () => this.plugin.store.duplicateCard(card.id));
    this.addIconButton(headerActions, 'Close card', 'x', () => this.plugin.store.removeCard(card.id));

    if (card.collapsed) return;

    const bodyViewport = cardEl.createDiv({ cls: 'card-library-card-body-viewport' });
    const minHeight = card.minHeightPx ?? this.plugin.store.getSettings().minCardHeightPx;
    const maxHeight = card.maxHeightPx ?? this.plugin.store.getSettings().maxCardHeightPx;
    bodyViewport.style.height = `${clamp(card.heightPx, minHeight, maxHeight)}px`;
    bodyViewport.style.minHeight = `${minHeight}px`;
    bodyViewport.style.maxHeight = `${maxHeight}px`;

    const body = bodyViewport.createDiv({ cls: 'card-library-card-body' });
    if (card.pinned) {
      bodyViewport.addEventListener('dragstart', (event) => event.preventDefault(), true);
    }
    void this.renderCardBody(card, body, bodyViewport);

    if (card.pinned) return;

    const resizer = cardEl.createDiv({
      cls: 'card-library-card-resizer',
      attr: {
        tabindex: '0',
        role: 'separator',
        'aria-label': 'Resize card height',
        'aria-valuenow': String(card.heightPx),
        title: 'Drag to resize',
      },
    });
    this.attachCardResizer(resizer, bodyViewport, card);
  }

  private addIconButton(parentEl: HTMLElement, title: string, icon: string, onClick: () => void): void {
    const button = parentEl.createEl('button', { attr: { title, 'aria-label': title } });
    setIcon(button, icon);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
  }

  private async renderCardBody(card: CardInstance, bodyEl: HTMLElement, viewportEl: HTMLElement): Promise<void> {
    const file = this.plugin.store.getSourceFile(card);
    if (!file) {
      bodyEl.createDiv({ cls: 'card-library-error', text: 'Source file is missing.' });
      return;
    }

    if (card.source.type === 'markdown') {
      const markdown = await this.app.vault.cachedRead(file);
      bodyEl.empty();
      bodyEl.addClasses(['markdown-reading-view', 'markdown-preview-view', 'markdown-rendered', 'card-library-markdown-rendered']);
      await MarkdownRenderer.render(this.app, markdown, bodyEl, file.path, this);
      if (card.markdownState?.scrollTop) viewportEl.scrollTop = card.markdownState.scrollTop;
      viewportEl.addEventListener('scroll', () => {
        card.markdownState = { ...card.markdownState, scrollTop: viewportEl.scrollTop };
        this.plugin.store.patchCardDebounced(card.id, { markdownState: card.markdownState });
      });
      return;
    }

    if (card.source.type === 'pdf') {
      const frame = bodyEl.createEl('iframe', {
        cls: 'card-library-pdf-frame',
        attr: { src: this.app.vault.getResourcePath(file), title: file.basename },
      });
      frame.addEventListener('load', () => {
        if (card.pdfState?.scrollTop) viewportEl.scrollTop = card.pdfState.scrollTop;
      });
      viewportEl.addEventListener('scroll', () => {
        card.pdfState = { ...card.pdfState, scrollTop: viewportEl.scrollTop };
        this.plugin.store.patchCardDebounced(card.id, { pdfState: card.pdfState });
      });
      return;
    }

    if (card.source.type === 'image') {
      bodyEl.empty();
      bodyEl.addClass('card-library-image-body');
      bodyEl.createEl('img', {
        cls: 'card-library-image-preview',
        attr: { src: this.app.vault.getResourcePath(file), alt: file.basename },
      });
      return;
    }

    bodyEl.createDiv({ cls: 'card-library-error', text: 'Unsupported file type.' });
  }

  private getCardTypeLabel(card: CardInstance): string {
    if (card.source.type === 'pdf') return 'PDF';
    if (card.source.type === 'image') return 'IMG';
    return 'MD';
  }

  private attachCardResizer(handleEl: HTMLElement, bodyViewportEl: HTMLElement, card: CardInstance): void {
    const settings = this.plugin.store.getSettings();
    const minHeight = card.minHeightPx ?? settings.minCardHeightPx;
    const maxHeight = card.maxHeightPx ?? settings.maxCardHeightPx;

    const setHeight = (height: number, saveNow: boolean) => {
      const nextHeight = clamp(Math.round(height), minHeight, maxHeight);
      bodyViewportEl.style.height = `${nextHeight}px`;
      handleEl.setAttr('aria-valuenow', String(nextHeight));
      if (saveNow) {
        this.plugin.store.patchCard(card.id, { heightMode: 'custom', heightPx: nextHeight });
      } else {
        this.plugin.store.patchCardDebounced(card.id, { heightMode: 'custom', heightPx: nextHeight });
      }
    };

    handleEl.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handleEl.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startHeight = bodyViewportEl.getBoundingClientRect().height;

      const onPointerMove = (moveEvent: PointerEvent) => {
        setHeight(startHeight + moveEvent.clientY - startY, false);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        handleEl.releasePointerCapture(upEvent.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        this.plugin.store.flushDebouncedSave();
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    handleEl.addEventListener('dblclick', () => setHeight(settings.defaultCardHeightPx, true));
    handleEl.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      const step = settings.resizeStepPx * (event.shiftKey ? 4 : 1);
      setHeight(bodyViewportEl.getBoundingClientRect().height + direction * step, true);
    });
  }

  private async openSource(card: CardInstance): Promise<void> {
    const file = this.plugin.store.getSourceFile(card);
    if (!file) {
      new Notice('Source file is missing.');
      return;
    }
    await this.app.workspace.getLeaf('tab').openFile(file, { active: true });
  }

  private insertReference(card: CardInstance): void {
    const file = this.plugin.store.getSourceFile(card);
    if (!file) {
      new Notice('Source file is missing.');
      return;
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.editor) {
      new Notice('No active Markdown editor.');
      return;
    }

    const sourcePath = view.file?.path ?? '';
    const link = this.app.fileManager.generateMarkdownLink(file, sourcePath, card.markdownState?.subpath);
    const page = card.source.type === 'pdf' && card.pdfState?.page ? ` p. ${card.pdfState.page}` : '';
    view.editor.replaceSelection(`${link}${page}`);
    view.editor.focus();
  }

  private readonly handleSidebarDragOver = (event: DragEvent) => {
    if (this.isInternalCardSortInProgress()) return;
    if (this.isCardReorderTarget(event)) return;
    if (!this.resolveDroppedFile(event.dataTransfer) && !this.getDraggedWorkspaceTabFile()) return;
    this.claimDragEvent(event);
    this.rootEl?.addClass('is-drop-target');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };

  private readonly handleSidebarDragLeave = (event: DragEvent) => {
    if (this.rootEl?.contains(event.relatedTarget as Node | null)) return;
    this.rootEl?.removeClass('is-drop-target');
  };

  private readonly handleSidebarDrop = (event: DragEvent) => {
    if (this.isInternalCardSortInProgress()) return;
    if (this.isCardReorderTarget(event)) return;
    this.rootEl?.removeClass('is-drop-target');
    const workspaceTab = this.getDraggedWorkspaceTab();
    const file = this.resolveDroppedFile(event.dataTransfer) ?? workspaceTab?.file ?? null;
    if (!file) return;
    this.claimDragEvent(event);
    this.plugin.store.addFileAsNewCard(file);
    if (workspaceTab?.leaf && workspaceTab.leaf !== this.leaf) workspaceTab.leaf.detach();
    this.clearDraggedWorkspaceTabSoon();
  };

  private claimDragEvent(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private isCardReorderTarget(event: DragEvent): boolean {
    return !!this.getDraggedCardPayload(event.dataTransfer)
      && event.target instanceof HTMLElement
      && !!event.target.closest('.card-library-card');
  }

  private destroySortables(): void {
    for (const sortable of this.sortables) sortable.destroy();
    this.sortables = [];
  }

  private isInternalCardSortInProgress(): boolean {
    return this.isSortingCards || Date.now() < this.ignoreInternalSortDropsUntil;
  }

  private isWorkspaceTabHeaderDrag(event: DragEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('.workspace-tab-header');
  }

  private getDraggedWorkspaceTabFile(): TFile | null {
    return this.getDraggedWorkspaceTab()?.file ?? null;
  }

  private getDraggedWorkspaceTab(): DraggedWorkspaceTab | null {
    if (!this.draggedWorkspaceTab) return null;
    if (Date.now() - this.draggedWorkspaceTab.startedAt > 10_000) {
      this.draggedWorkspaceTab = null;
      return null;
    }
    return this.draggedWorkspaceTab;
  }

  private clearDraggedWorkspaceTabSoon(): void {
    window.setTimeout(() => {
      this.draggedWorkspaceTab = null;
      this.rootEl?.removeClass('is-drop-target');
    }, 0);
  }

  private getDraggedCardPayload(dataTransfer: DataTransfer | null): DraggedCardPayload | null {
    const raw = dataTransfer?.getData(CARD_LIBRARY_DRAG_MIME);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<DraggedCardPayload>;
      if (!parsed.cardId || !parsed.path) return null;
      return { cardId: parsed.cardId, path: parsed.path };
    } catch {
      return null;
    }
  }

  private resolveDroppedFile(dataTransfer: DataTransfer | null): TFile | null {
    const cardPayload = this.getDraggedCardPayload(dataTransfer);
    if (cardPayload) return this.getFileByPath(cardPayload.path);

    const droppedPath = dataTransfer?.getData(CARD_LIBRARY_PATH_MIME)
      || dataTransfer?.getData('text/plain')
      || dataTransfer?.getData('text/uri-list');
    const file = this.getFileByPath(this.normalizeDroppedPath(droppedPath));
    if (file) return file;
    return null;
  }

  private normalizeDroppedPath(rawPath: string | undefined): string {
    if (!rawPath) return '';
    return rawPath
      .split('\n')[0]
      .replace(/^obsidian:\/\/open\?path=/, '')
      .replace(/^file:\/\//, '')
      .trim();
  }

  private getFileByPath(path: string): TFile | null {
    if (!path) return null;
    const exact = this.app.vault.getAbstractFileByPath(path);
    if (exact instanceof TFile && isSupportedFile(exact)) return exact;

    const suffix = decodeURIComponent(path).replace(/\\/g, '/');
    const file = this.app.vault.getFiles().find((candidate) => suffix.endsWith(candidate.path));
    return file && isSupportedFile(file) ? file : null;
  }

  private async openDraggedCardInEditor(payload: DraggedCardPayload): Promise<void> {
    const file = this.getFileByPath(payload.path);
    if (!file) return;
    await this.app.workspace.getLeaf('tab').openFile(file, { active: true });
    this.plugin.store.removeCard(payload.cardId);
  }
}
