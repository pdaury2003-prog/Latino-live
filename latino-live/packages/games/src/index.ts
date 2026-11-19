/**
 * Registro del motor: un solo punto para que el servidor y la app sepan qué
 * juegos existen, quién los ve y cómo se aplica una acción.
 */

import {
  type ActionResult,
  type CreateInput,
  type GameAction,
  type GameKind,
  type GameVisibility,
  type PlayerId,
  type Rng,
  type SettlementEntry,
} from './types.ts';
import { chessEngine, type ChessState } from './chess.ts';
import { checkersEngine, type CheckersState } from './checkers.ts';
import { dominoEngine, type DominoState } from './domino.ts';
import { ludoEngine, type LudoState } from './ludo.ts';
import { slotsEngine, type SlotsState } from './casino/slots.ts';
import { pokerEngine, type PokerState } from './casino/poker.ts';
import { rouletteEngine, type RouletteState } from './casino/roulette.ts';
import { blackjackEngine, type BlackjackState } from './casino/blackjack.ts';

export * from './types.ts';
export * from './rng.ts';
export * from './betting.ts';
export * from './cards.ts';
export * from './chess.ts';
export * from './checkers.ts';
export * from './ludo.ts';
export * from './domino.ts';
export * from './casino/slots.ts';
export * from './casino/poker.ts';
export * from './casino/roulette.ts';
export * from './casino/blackjack.ts';

export type GameState =
  | ChessState
  | CheckersState
  | LudoState
  | DominoState
  | SlotsState
  | PokerState
  | RouletteState
  | BlackjackState;

export type GameInfo = {
  kind: GameKind;
  name: string;
  visibility: GameVisibility;
  minPlayers: number;
  maxPlayers: number;
  /** El casino se abre en una capa privada, no en el canal de la sala. */
  casino: boolean;
};

export const GAME_CATALOG: readonly GameInfo[] = [
  { kind: 'chess', name: 'Ajedrez', visibility: 'table', minPlayers: 2, maxPlayers: 2, casino: false },
  { kind: 'checkers', name: 'Damas', visibility: 'table', minPlayers: 2, maxPlayers: 2, casino: false },
  { kind: 'ludo', name: 'Ludo', visibility: 'table', minPlayers: 2, maxPlayers: 4, casino: false },
  { kind: 'domino', name: 'Dominó', visibility: 'table', minPlayers: 2, maxPlayers: 4, casino: false },
  { kind: 'slots', name: 'Tragamonedas', visibility: 'private', minPlayers: 1, maxPlayers: 1, casino: true },
  { kind: 'poker', name: 'Póker', visibility: 'private', minPlayers: 2, maxPlayers: 6, casino: true },
  { kind: 'roulette', name: 'Ruleta', visibility: 'private', minPlayers: 1, maxPlayers: 1, casino: true },
  { kind: 'blackjack', name: 'Blackjack', visibility: 'private', minPlayers: 1, maxPlayers: 1, casino: true },
];

export function gameInfo(kind: GameKind): GameInfo {
  const info = GAME_CATALOG.find(game => game.kind === kind);
  if (!info) throw new Error(`Juego desconocido: ${kind}`);
  return info;
}

export function isCasino(kind: GameKind): boolean {
  return gameInfo(kind).visibility === 'private';
}

export function createGame(kind: GameKind, input: CreateInput): GameState {
  switch (kind) {
    case 'chess': return chessEngine.create(input);
    case 'checkers': return checkersEngine.create(input);
    case 'ludo': return ludoEngine.create(input);
    case 'domino': return dominoEngine.create(input);
    case 'slots': return slotsEngine.create(input);
    case 'poker': return pokerEngine.create(input);
    case 'roulette': return rouletteEngine.create(input);
    case 'blackjack': return blackjackEngine.create(input);
  }
}

export function applyGameAction(state: GameState, action: GameAction, rng: Rng): ActionResult<GameState> {
  switch (state.kind) {
    case 'chess': return chessEngine.apply(state, action, rng);
    case 'checkers': return checkersEngine.apply(state, action, rng);
    case 'ludo': return ludoEngine.apply(state, action, rng);
    case 'domino': return dominoEngine.apply(state, action, rng);
    case 'slots': return slotsEngine.apply(state, action, rng);
    case 'poker': return pokerEngine.apply(state, action, rng);
    case 'roulette': return rouletteEngine.apply(state, action, rng);
    case 'blackjack': return blackjackEngine.apply(state, action, rng);
  }
}

export function viewGame(state: GameState, viewerId: PlayerId | null): GameState {
  switch (state.kind) {
    case 'chess': return chessEngine.view(state, viewerId);
    case 'checkers': return checkersEngine.view(state, viewerId);
    case 'ludo': return ludoEngine.view(state, viewerId);
    case 'domino': return dominoEngine.view(state, viewerId);
    case 'slots': return slotsEngine.view(state, viewerId);
    case 'poker': return pokerEngine.view(state, viewerId);
    case 'roulette': return rouletteEngine.view(state, viewerId);
    case 'blackjack': return blackjackEngine.view(state, viewerId);
  }
}

export function settlementFor(state: GameState): SettlementEntry[] {
  switch (state.kind) {
    case 'chess': return chessEngine.settlement(state);
    case 'checkers': return checkersEngine.settlement(state);
    case 'ludo': return ludoEngine.settlement(state);
    case 'domino': return dominoEngine.settlement(state);
    case 'slots': return slotsEngine.settlement(state);
    case 'poker': return pokerEngine.settlement(state);
    case 'roulette': return rouletteEngine.settlement(state);
    case 'blackjack': return blackjackEngine.settlement(state);
  }
}

export function isGameOver(state: GameState): boolean {
  switch (state.kind) {
    case 'chess': return chessEngine.isOver(state);
    case 'checkers': return checkersEngine.isOver(state);
    case 'ludo': return ludoEngine.isOver(state);
    case 'domino': return dominoEngine.isOver(state);
    case 'slots': return slotsEngine.isOver(state);
    case 'poker': return pokerEngine.isOver(state);
    case 'roulette': return rouletteEngine.isOver(state);
    case 'blackjack': return blackjackEngine.isOver(state);
  }
}

export function legalActionsFor(state: GameState, userId: PlayerId): GameAction[] {
  switch (state.kind) {
    case 'chess': return chessEngine.legalActions(state, userId);
    case 'checkers': return checkersEngine.legalActions(state, userId);
    case 'ludo': return ludoEngine.legalActions(state, userId);
    case 'domino': return dominoEngine.legalActions(state, userId);
    case 'slots': return slotsEngine.legalActions(state, userId);
    case 'poker': return pokerEngine.legalActions(state, userId);
    case 'roulette': return rouletteEngine.legalActions(state, userId);
    case 'blackjack': return blackjackEngine.legalActions(state, userId);
  }
}
