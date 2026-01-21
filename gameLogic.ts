
import { Card, CardColor } from './types';

export const canPlayCard = (card: Card, currentCard: Card | null, activeColor: CardColor | null, pendingDraw: number = 0): boolean => {
  if (!card) return false;
  if (!currentCard) return true;

  // Stacking logic: If there's a pending draw, you MUST play a matching or higher draw card
  if (pendingDraw > 0) {
    // Standard stacking: +2 on +2, +4 on any draw (or standard house rule: any draw on any draw)
    return card.value === 'draw2' || card.value === 'draw4';
  }

  // Wilds can always be played if no draw is pending
  if (card.color === 'wild' || card.value === 'draw4') {
    return true;
  }

  const targetColor = activeColor || currentCard.color;
  
  // Playable if color matches or value matches
  return card.color === targetColor || card.value === currentCard.value;
};

export const getNextTurnIndex = (currentIndex: number, playerCount: number, direction: 1 | -1): number => {
  let next = currentIndex + direction;
  if (next >= playerCount) next = 0;
  if (next < 0) next = playerCount - 1;
  return next;
};

export const shuffle = <T,>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
