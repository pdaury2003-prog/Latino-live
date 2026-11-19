/** Cartas y barajas compartidas por el póker y el blackjack. */

import { fail, shuffled, type Rng } from './types.ts';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type Card = { rank: Rank; suit: Suit; code: string };

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANK_LABEL: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export function fullDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank += 1) {
      cards.push({ rank: rank as Rank, suit, code: `${RANK_LABEL[rank as Rank]}${suit}` });
    }
  }
  return cards;
}

/** Zapato de 6 barajas: lo normal en una mesa de blackjack. */
export function shoe(decks = 6): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < decks; deck += 1) cards.push(...fullDeck());
  return cards;
}

export function shuffledDeck(rng: Rng, decks = 1): Card[] {
  return shuffled(decks === 1 ? fullDeck() : shoe(decks), rng);
}

export function drawCard(deck: Card[]): Card {
  const card = deck.pop();
  if (!card) fail('empty_deck', 'La baraja se quedó sin cartas.');
  return card;
}

/** El blackjack cuenta el as como 11 o 1 según convenga. */
export function handValue(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 14) {
      total += 11;
      aces += 1;
    } else if (card.rank >= 10) {
      total += 10;
    } else {
      total += card.rank;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}
