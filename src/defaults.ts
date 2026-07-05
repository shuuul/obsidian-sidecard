import { CURRENT_SCHEMA_VERSION } from './constants';
import type { CardLibraryPluginData, CardLibrarySettings } from './types';

export const DEFAULT_SETTINGS: CardLibrarySettings = {
  defaultSidebarSide: 'right',
  defaultCardHeightPx: 520,
  minCardHeightPx: 160,
  maxCardHeightPx: 1600,
  resizeStepPx: 32,
  resizeSaveDebounceMs: 250,
  defaultCollapsed: false,
  maxExpandedCards: 4,
  protectPinnedExpansion: true,
  unloadBodyWhenCollapsed: true,
  showFilePath: 'always',
  defaultPdfRenderer: 'basic',
  insertFormat: 'wiki-link',
  confirmBeforeBulkRemoveCount: 8,
};

export function createDefaultData(): CardLibraryPluginData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    state: { cards: [] },
  };
}

export function normalizeData(raw: unknown): CardLibraryPluginData {
  const defaults = createDefaultData();
  if (!raw || typeof raw !== 'object') return defaults;

  const data = raw as Partial<CardLibraryPluginData>;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    state: {
      cards: Array.isArray(data.state?.cards) ? data.state.cards : [],
      activeCardId: data.state?.activeCardId,
      lastSearchQuery: data.state?.lastSearchQuery,
      viewScrollTop: data.state?.viewScrollTop,
    },
  };
}
