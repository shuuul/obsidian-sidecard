import { Plugin, TFile } from 'obsidian';
import { CardStore } from '../../src/store/CardStore';

function createStore() {
  const files = new Map<string, TFile>();
  const app = {
    vault: {
      getAbstractFileByPath: jest.fn((path: string) => files.get(path) ?? null),
    },
  };
  const plugin = new Plugin(app);
  const store = new CardStore(plugin);
  return { app, files, plugin, store };
}

describe('CardStore', () => {
  it('keeps pinned cards in manual order', async () => {
    const { files, store } = createStore();
    const alpha = new TFile('Alpha.md');
    const beta = new TFile('Beta.md');
    files.set(alpha.path, alpha);
    files.set(beta.path, beta);

    await store.load();
    const first = store.addFileAsNewCard(alpha);
    const second = store.addFileAsNewCard(beta);

    store.togglePinned(second.id);

    expect(store.getState().cards.map((card) => ({ id: card.id, order: card.manualOrder, pinned: card.pinned }))).toEqual([
      { id: first.id, order: 1, pinned: false },
      { id: second.id, order: 2, pinned: true },
    ]);
  });

  it('persists reordered card IDs as manual order', async () => {
    const { files, store } = createStore();
    const alpha = new TFile('Alpha.md');
    const beta = new TFile('Beta.md');
    const gamma = new TFile('Gamma.md');
    for (const file of [alpha, beta, gamma]) files.set(file.path, file);

    await store.load();
    const first = store.addFileAsNewCard(alpha);
    const second = store.addFileAsNewCard(beta);
    const third = store.addFileAsNewCard(gamma);

    store.reorderCards([third.id, first.id, second.id]);

    expect([...store.getState().cards].sort((a, b) => a.manualOrder - b.manualOrder).map((card) => card.id))
      .toEqual([third.id, first.id, second.id]);
  });
});
