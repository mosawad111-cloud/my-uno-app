
import { Card, GameState, CardColor } from './types';

export const canPlayCard = (card: Card, currentCard: Card | null, activeColor: CardColor | null): boolean => {
  if (!currentCard) return true;
  
  // Wild cards can always be played (technically canPlay rules vary but usually any time)
  if (card.color === 'wild') return true;
  
  const targetColor = activeColor || currentCard.color;
  
  // Match color
  if (card.color === targetColor) return true;
  
  // Match value
  if (card.value === currentCard.value) return true;
  
  return false;
};

export const getNextTurnIndex = (currentIndex: number, playerCount: number, direction: number): number => {
  let next = currentIndex + direction;
  if (next >= playerCount) next = 0;
  if (next < 0) next = playerCount - 1;
  return next;
};

export const shuffle = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};
