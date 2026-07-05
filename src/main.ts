import { Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_CARD_LIBRARY } from './constants';
import { FileAddSuggestModal } from './modals/FileAddSuggestModal';
import { CardLibrarySettingTab } from './settings/CardLibrarySettingTab';
import { CardStore } from './store/CardStore';
import { isSupportedFile } from './utils/files';
import { CardLibraryView } from './views/CardLibraryView';

export default class CardLibraryPlugin extends Plugin {
  store!: CardStore;

  async onload(): Promise<void> {
    this.store = new CardStore(this);
    await this.store.load();

    this.registerView(VIEW_TYPE_CARD_LIBRARY, (leaf) => new CardLibraryView(leaf, this));

    this.addRibbonIcon('library', 'Open SideCard', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-card-library',
      name: 'Open',
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: 'add-active-file-as-card',
      name: 'Add active file as card',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const canRun = file instanceof TFile && isSupportedFile(file);
        if (checking) return canRun;
        if (file && canRun) {
          this.store.addFileAsNewCard(file);
          void this.activateView();
        }
        return canRun;
      },
    });

    this.addCommand({
      id: 'search-file-and-add-card',
      name: 'Search file and add as card',
      callback: () => new FileAddSuggestModal(this.app, this).open(),
    });

    this.addSettingTab(new CardLibrarySettingTab(this.app, this));
    this.registerVaultEvents();
  }

  onunload(): void {
    this.store.flushDebouncedSave();
  }

  async activateView(): Promise<void> {
    let leaf: WorkspaceLeaf | null = null;
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_LIBRARY);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = this.store.getSettings().defaultSidebarSide === 'left'
        ? this.app.workspace.getLeftLeaf(false)
        : this.app.workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_CARD_LIBRARY, active: true });
    }
    if (leaf) await this.app.workspace.revealLeaf(leaf);
  }

  private registerVaultEvents(): void {
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.store.handleFileRenamed(file, oldPath)));
    this.registerEvent(this.app.vault.on('delete', (file) => this.store.handleFileDeleted(file)));
    this.registerEvent(this.app.vault.on('modify', (file) => this.store.handleFileModified(file)));
  }
}
