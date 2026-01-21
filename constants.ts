
import { Card, CardColor, CardValue } from './types';

export const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];
export const VALUES: CardValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

export type TrackType = 'url' | 'procedural';

export interface Track {
  id: string;
  name: string;
  file: string;
  color: string;
  type: TrackType;
}

export const TRACKS: Track[] = [
  { 
    id: 'frozy', 
    name: 'Frozy', 
    file: 'https://cheeser.vip/Uno/Frozy',
    color: '#3b82f6',
    type: 'url'
  },
  { 
    id: 'pursuit', 
    name: 'Pursuit', 
    file: 'https://cheeser.vip/Uno/Pursuit',
    color: '#f43f5e',
    type: 'url'
  },
  { 
    id: 'frenchman', 
    name: 'Frenchman', 
    file: 'https://cheeser.vip/Uno/Frenchman',
    color: '#8b5cf6',
    type: 'url'
  },
  { 
    id: 'procedural_1', 
    name: 'Wave Station Alpha', 
    file: 'procedural_1',
    color: '#10b981',
    type: 'procedural'
  }
];

export const BG_COLORS: Record<CardColor, string> = {
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  wild: 'bg-slate-900'
};

export const TEXT_COLORS: Record<CardColor, string> = {
  red: 'text-red-600',
  blue: 'text-blue-600',
  green: 'text-green-500',
  yellow: 'text-yellow-400',
  wild: 'text-slate-900'
};

export const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Daisy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ewan'
];

export const createFullDeck = (): Card[] => {
  const deck: Card[] = [];
  COLORS.forEach(color => {
    deck.push({ id: `${color}-0-${Math.random()}`, color, value: '0' });
    for (let i = 0; i < 2; i++) {
      VALUES.slice(1).forEach(val => {
        deck.push({ id: `${color}-${val}-${i}-${Math.random()}`, color, value: val });
      });
    }
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}-${Math.random()}`, color: 'wild', value: 'wild' });
    deck.push({ id: `draw4-${i}-${Math.random()}`, color: 'wild', value: 'draw4' });
  }
  return deck.sort(() => Math.random() - 0.5);
};
