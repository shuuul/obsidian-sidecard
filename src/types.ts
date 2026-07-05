export type CardSourceType = 'markdown' | 'pdf' | 'image' | 'other';
export type CardHeightMode = 'custom' | 'auto';

export interface MarkdownCardState {
  subpath?: string;
  scrollTop?: number;
  selectionText?: string;
}

export interface PdfCardState {
  page?: number;
  scale?: number;
  scrollTop?: number;
  selectionText?: string;
}

export interface CardInstance {
  id: string;
  source: {
    type: CardSourceType;
    path: string;
  };
  title: string;
  userTitle?: string;
  instanceLabel?: string;
  collapsed: boolean;
  pinned: boolean;
  missing: boolean;
  heightMode: CardHeightMode;
  heightPx: number;
  minHeightPx?: number;
  maxHeightPx?: number;
  manualOrder: number;
  pinOrder: number | null;
  createdAt: number;
  updatedAt: number;
  lastViewedAt?: number;
  markdownState?: MarkdownCardState;
  pdfState?: PdfCardState;
}

export interface CardLibrarySettings {
  defaultSidebarSide: 'left' | 'right';
  defaultCardHeightPx: number;
  minCardHeightPx: number;
  maxCardHeightPx: number;
  resizeStepPx: number;
  resizeSaveDebounceMs: number;
  defaultCollapsed: boolean;
  maxExpandedCards: number;
  protectPinnedExpansion: boolean;
  unloadBodyWhenCollapsed: boolean;
  showFilePath: 'always' | 'hover' | 'never';
  defaultPdfRenderer: 'basic' | 'pdfjs';
  insertFormat: 'wiki-link' | 'markdown-link';
  confirmBeforeBulkRemoveCount: number;
}

export interface CardLibraryState {
  cards: CardInstance[];
  activeCardId?: string;
  lastSearchQuery?: string;
  viewScrollTop?: number;
}

export interface CardLibraryPluginData {
  schemaVersion: number;
  settings: CardLibrarySettings;
  state: CardLibraryState;
}
