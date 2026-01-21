
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  getDoc 
} from 'firebase/firestore';
import { GameState, Player, Card, CardColor } from './types';
import { createFullDeck } from './constants';
import { canPlayCard, getNextTurnIndex, shuffle } from './gameLogic';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

const App: React.FC = () => {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize unique user ID
  useEffect(() => {
    const savedId = localStorage.getItem('uno_player_id');
    const id = savedId || Math.random().toString(36).substr(2, 9);
    if (!savedId) localStorage.setItem('uno_player_id', id);
    
    const savedName = localStorage.getItem('uno_player_name') || `Player_${id.substr(0, 4)}`;
    setUser({ id, name: savedName });
  }, []);

  // Listen for game state updates
  useEffect(() => {
    if (!roomId) return;

    const unsub = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data() as GameState);
      } else {
        setError('Room not found');
        setRoomId(null);
      }
    });

    return () => unsub();
  }, [roomId]);

  const handleCreateRoom = async (name: string) => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const newPlayer: Player = { id: user!.id, name, hand: [], isUno: false, ready: true };
    
    const initialState: GameState = {
      roomId: newRoomId,
      players: [newPlayer],
      status: 'lobby',
      currentCard: null,
      discardPile: [],
      drawPile: [],
      turnIndex: 0,
      direction: 1,
      winner: null,
      pendingDraw: 0,
      activeColor: null,
      logs: [`${name} created the room!`]
    };

    try {
      await setDoc(doc(db, 'rooms', newRoomId), initialState);
      setRoomId(newRoomId);
      localStorage.setItem('uno_player_name', name);
      setUser(prev => prev ? { ...prev, name } : null);
    } catch (err) {
      setError('Failed to create room. Check Firebase setup.');
    }
  };

  const handleJoinRoom = async (code: string, name: string) => {
    const roomRef = doc(db, 'rooms', code);
    const docSnap = await getDoc(roomRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as GameState;
      if (data.status !== 'lobby') {
        setError('Game already in progress');
        return;
      }
      if (data.players.length >= 6) {
        setError('Room full');
        return;
      }

      const newPlayer: Player = { id: user!.id, name, hand: [], isUno: false, ready: true };
      await updateDoc(roomRef, {
        players: [...data.players, newPlayer],
        logs: [...data.logs, `${name} joined!`]
      });
      setRoomId(code);
      localStorage.setItem('uno_player_name', name);
      setUser(prev => prev ? { ...prev, name } : null);
    } else {
      setError('Invalid room code');
    }
  };

  const startGame = async () => {
    if (!gameState || !roomId) return;
    
    const deck = createFullDeck();
    const players = [...gameState.players];
    
    // Deal 7 cards each
    players.forEach(p => {
      p.hand = deck.splice(0, 7);
      p.isUno = false;
    });

    // Top card
    let topCard = deck.pop()!;
    // Ensure top card isn't wild for start (standard rule simplified)
    while (topCard.color === 'wild') {
      deck.unshift(topCard);
      topCard = deck.pop()!;
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'playing',
      players,
      drawPile: deck,
      currentCard: topCard,
      discardPile: [topCard],
      logs: [...gameState.logs, 'The game has started!']
    });
  };

  const playCard = async (cardIndex: number, pickedColor?: CardColor) => {
    if (!gameState || !roomId || !user) return;
    
    const currentPlayer = gameState.players[gameState.turnIndex];
    if (currentPlayer.id !== user.id) return;

    const card = currentPlayer.hand[cardIndex];
    if (!canPlayCard(card, gameState.currentCard, gameState.activeColor)) return;

    let newPlayers = [...gameState.players];
    const playerInList = newPlayers[gameState.turnIndex];
    playerInList.hand.splice(cardIndex, 1);
    
    // Reset UNO if they didn't click it and they should have?
    // Simplified: player must click UNO button *before* or *during* their play if they will have 1 card.
    
    let nextTurn = gameState.turnIndex;
    let nextDirection = gameState.direction;
    let nextPendingDraw = gameState.pendingDraw;
    let newLogs = [...gameState.logs, `${user.name} played ${card.color} ${card.value}`];

    // Card effects
    if (card.value === 'skip') {
      nextTurn = getNextTurnIndex(nextTurn, newPlayers.length, nextDirection);
    } else if (card.value === 'reverse') {
      if (newPlayers.length === 2) {
        nextTurn = getNextTurnIndex(nextTurn, newPlayers.length, nextDirection);
      } else {
        nextDirection *= -1;
      }
    } else if (card.value === 'draw2') {
      nextPendingDraw += 2;
    } else if (card.value === 'draw4') {
      nextPendingDraw += 4;
    }

    // Win condition
    if (playerInList.hand.length === 0) {
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'ended',
        winner: user.name,
        logs: [...newLogs, `${user.name} WINS!`]
      });
      return;
    }

    // Move turn
    nextTurn = getNextTurnIndex(nextTurn, newPlayers.length, nextDirection);

    await updateDoc(doc(db, 'rooms', roomId), {
      players: newPlayers,
      currentCard: card,
      discardPile: [card, ...gameState.discardPile],
      turnIndex: nextTurn,
      direction: nextDirection,
      pendingDraw: nextPendingDraw,
      activeColor: card.color === 'wild' ? pickedColor : null,
      logs: newLogs
    });
  };

  const drawCard = async () => {
    if (!gameState || !roomId || !user) return;
    const currentPlayer = gameState.players[gameState.turnIndex];
    if (currentPlayer.id !== user.id) return;

    let newPlayers = [...gameState.players];
    let newDrawPile = [...gameState.drawPile];
    let newDiscardPile = [...gameState.discardPile];

    // Reshuffle discard if draw empty
    if (newDrawPile.length <= Math.max(1, gameState.pendingDraw)) {
      const top = newDiscardPile.shift()!;
      newDrawPile = shuffle([...newDiscardPile]);
      newDiscardPile = [top];
    }

    const cardsToDrawCount = gameState.pendingDraw || 1;
    const drawnCards = newDrawPile.splice(0, cardsToDrawCount);
    newPlayers[gameState.turnIndex].hand.push(...drawnCards);
    newPlayers[gameState.turnIndex].isUno = false; // Reset Uno status if they draw

    const nextTurn = getNextTurnIndex(gameState.turnIndex, newPlayers.length, gameState.direction);

    await updateDoc(doc(db, 'rooms', roomId), {
      players: newPlayers,
      drawPile: newDrawPile,
      discardPile: newDiscardPile,
      pendingDraw: 0,
      turnIndex: nextTurn,
      logs: [...gameState.logs, `${user.name} drew ${cardsToDrawCount} card(s)`]
    });
  };

  const handleUno = async () => {
    if (!gameState || !roomId || !user) return;
    const playerIdx = gameState.players.findIndex(p => p.id === user.id);
    if (playerIdx === -1) return;

    const newPlayers = [...gameState.players];
    newPlayers[playerIdx].isUno = true;

    await updateDoc(doc(db, 'rooms', roomId), {
      players: newPlayers,
      logs: [...gameState.logs, `${user.name} shouted UNO!`]
    });
  };

  if (!user) return <div className="flex h-screen items-center justify-center">Loading profile...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-start bg-slate-900 overflow-x-hidden">
      <header className="mb-8 flex flex-col items-center">
        <h1 className="text-6xl uno-font text-red-600 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] select-none">UNO</h1>
        <p className="text-slate-400 font-semibold tracking-widest mt-2 uppercase text-xs">Multiplayer Pro</p>
      </header>

      {error && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce">
          {error}
          <button onClick={() => setError(null)} className="ml-4 font-bold">X</button>
        </div>
      )}

      {!roomId ? (
        <Lobby 
          userName={user.name} 
          onCreate={handleCreateRoom} 
          onJoin={handleJoinRoom} 
        />
      ) : gameState ? (
        <GameBoard 
          gameState={gameState} 
          userId={user.id} 
          onStart={startGame} 
          onPlayCard={playCard} 
          onDraw={drawCard}
          onUno={handleUno}
          onLeave={() => { setRoomId(null); setGameState(null); }}
        />
      ) : (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse delay-75"></div>
          <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse delay-150"></div>
          <span className="ml-2 font-bold text-slate-400">Connecting to server...</span>
        </div>
      )}
    </div>
  );
};

export default App;
