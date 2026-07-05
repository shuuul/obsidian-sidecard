import { App, SuggestModal, TFile } from 'obsidian';
import type CardLibraryPlugin from '../main';
import { isSupportedFile } from '../utils/files';

export class FileAddSuggestModal extends SuggestModal<TFile> {
  constructor(app: App, private plugin: CardLibraryPlugin) {
    super(app);
    this.setPlaceholder('Search Markdown, PDF, or image files to add as a new card');
    this.emptyStateText = 'No supported files found.';
  }

  getSuggestions(query: string): TFile[] {
    const normalized = query.trim().toLowerCase();
    return this.app.vault.getFiles()
      .filter(isSupportedFile)
      .filter((file) => {
        if (!normalized) return true;
        const cache = file.extension === 'md' ? this.app.metadataCache.getFileCache(file) : null;
        const frontmatter = cache?.frontmatter;
        const aliases = Array.isArray(frontmatter?.aliases) ? frontmatter.aliases.join(' ') : String(frontmatter?.aliases ?? '');
        const title = String(frontmatter?.title ?? '');
        const tags = (cache?.tags ?? []).map((tag) => tag.tag).join(' ');
        return `${file.basename} ${file.path} ${title} ${aliases} ${tags}`.toLowerCase().includes(normalized);
      })
      .slice(0, 50);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createDiv({ cls: 'card-library-suggest-title', text: file.basename });
    el.createDiv({ cls: 'card-library-suggest-path', text: file.path });
  }

  onChooseSuggestion(file: TFile): void {
    this.plugin.store.addFileAsNewCard(file);
    void this.plugin.activateView();
  }
}
