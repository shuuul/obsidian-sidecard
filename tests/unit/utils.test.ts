import type { CardInstance } from '../../src/types';
import { getCardDisplayTitle, sortCardsForRender } from '../../src/utils/cards';
import { getSourceType, isSupportedFile } from '../../src/utils/files';
import { TFile } from 'obsidian';

function card(id: string, manualOrder: number, pinned = false): CardInstance {
  return {
    id,
    source: { type: 'markdown', path: `${id}.md` },
    title: id,
    collapsed: false,
    pinned,
    missing: false,
    heightMode: 'custom',
    heightPx: 320,
    manualOrder,
    pinOrder: pinned ? 1 : null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('card utilities', () => {
  it('sorts by manual order without moving pinned cards to the top', () => {
    expect(sortCardsForRender([card('pinned', 3, true), card('first', 1), card('second', 2)]).map((entry) => entry.id))
      .toEqual(['first', 'second', 'pinned']);
  });

  it('uses the missing source path as card title', () => {
    expect(getCardDisplayTitle({ ...card('missing', 1), missing: true, source: { type: 'markdown', path: 'Folder/Missing.md' } }))
      .toBe('Folder/Missing.md');
  });
});

describe('file utilities', () => {
  it.each([
    ['Note.md', 'markdown'],
    ['Paper.pdf', 'pdf'],
    ['Image.PNG', 'image'],
    ['Diagram.svg', 'image'],
  ] as const)('detects %s as %s', (path, sourceType) => {
    const file = new TFile(path);
    expect(isSupportedFile(file)).toBe(true);
    expect(getSourceType(file)).toBe(sourceType);
  });

  it('rejects unsupported files', () => {
    expect(isSupportedFile(new TFile('Archive.zip'))).toBe(false);
  });
});
