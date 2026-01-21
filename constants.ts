
import { CardColor, CardValue, Card } from './types';

export const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];
export const VALUES: CardValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

export const BG_COLORS: Record<CardColor, string> = {
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-400',
  wild: 'bg-gray-900',
};

export const TEXT_COLORS: Record<CardColor, string> = {
  red: 'text-red-600',
  blue: 'text-blue-600',
  green: 'text-green-600',
  yellow: 'text-yellow-400',
  wild: 'text-gray-900',
};

export const createFullDeck = (): Card[] => {
  const deck: Card[] = [];
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
  
  colors.forEach(color => {
    // 0 appears once per color
    deck.push({ id: `${color}-0`, color, value: '0' });
    // 1-9, skip, reverse, draw2 appear twice per color
    for (let i = 0; i < 2; i++) {
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'].forEach(val => {
        deck.push({ id: `${color}-${val}-${i}`, color, value: val as CardValue });
      });
    }
  });

  // Wild and Wild Draw 4 appear 4 times each
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}`, color: 'wild', value: 'wild' });
    deck.push({ id: `draw4-${i}`, color: 'wild', value: 'draw4' });
  }

  return deck.sort(() => Math.random() - 0.5);
};
