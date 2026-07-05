import { App, PluginSettingTab, Setting } from 'obsidian';
import type CardLibraryPlugin from '../main';

type NumericSettingKey = 'defaultCardHeightPx' | 'minCardHeightPx' | 'maxExpandedCards';

export class CardLibrarySettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CardLibraryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.store.getSettings();
    containerEl.empty();

    new Setting(containerEl)
      .setName('Default sidebar side')
      .setDesc('Where to create the SideCard view if it is not already open.')
      .addDropdown((dropdown) => dropdown
        .addOption('right', 'Right')
        .addOption('left', 'Left')
        .setValue(settings.defaultSidebarSide)
        .onChange((value) => this.plugin.store.updateSettings({ defaultSidebarSide: value as 'left' | 'right' })));

    new Setting(containerEl)
      .setName('Default card height')
      .setDesc('Initial body height for newly added cards.')
      .addText((text) => text
        .setValue(String(settings.defaultCardHeightPx))
        .onChange((value) => this.updateNumber('defaultCardHeightPx', value)));

    new Setting(containerEl)
      .setName('Minimum card height')
      .addText((text) => text
        .setValue(String(settings.minCardHeightPx))
        .onChange((value) => this.updateNumber('minCardHeightPx', value)));

    new Setting(containerEl)
      .setName('Maximum expanded cards')
      .setDesc('When exceeded, older unpinned expanded cards collapse automatically. Use 0 to disable.')
      .addText((text) => text
        .setValue(String(settings.maxExpandedCards))
        .onChange((value) => this.updateNumber('maxExpandedCards', value)));

    new Setting(containerEl)
      .setName('Protect pinned expansion')
      .setDesc('Skip pinned cards when auto-collapsing or using Collapse all.')
      .addToggle((toggle) => toggle
        .setValue(settings.protectPinnedExpansion)
        .onChange((value) => this.plugin.store.updateSettings({ protectPinnedExpansion: value })));

    new Setting(containerEl)
      .setName('New cards start collapsed')
      .addToggle((toggle) => toggle
        .setValue(settings.defaultCollapsed)
        .onChange((value) => this.plugin.store.updateSettings({ defaultCollapsed: value })));

    new Setting(containerEl)
      .setName('Show file path')
      .addDropdown((dropdown) => dropdown
        .addOption('always', 'Always')
        .addOption('never', 'Never')
        .setValue(settings.showFilePath)
        .onChange((value) => this.plugin.store.updateSettings({ showFilePath: value as 'always' | 'never' })));
  }

  private updateNumber(key: NumericSettingKey, value: string): void {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    this.plugin.store.updateSettings({ [key]: numeric });
  }
}
