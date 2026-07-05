import type { CardInstance } from '../types';

export function createCardId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `card_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sortCardsForRender(cards: CardInstance[]): CardInstance[] {
  return [...cards].sort((a, b) => {
    return a.manualOrder - b.manualOrder;
  });
}

export function getCardDisplayTitle(card: CardInstance): string {
  if (card.missing) return card.source.path;
  if (card.userTitle?.trim()) return card.userTitle.trim();
  if (card.instanceLabel?.trim()) return `${card.title} · ${card.instanceLabel}`;
  return card.title;
}
