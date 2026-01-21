export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type CardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'draw4' | 'wild';

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

export interface Player {
  id: string;
  name: string;
  avatarUrl: string;
  hand: Card[];
  isUno: boolean;
  ready: boolean;
}

export interface GameState {
  roomId: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'ended';
  currentCard: Card | null;
  discardPile: Card[];
  drawPile: Card[];
  turnIndex: number;
  direction: 1 | -1;
  winner: string | null;
  pendingDraw: number;
  activeColor: CardColor | null;
  logs: string[];
}