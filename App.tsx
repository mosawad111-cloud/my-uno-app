import React, { useState, useEffect } from 'react';
import { db } from './firebase.js';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  getDoc 
} from 'firebase/firestore';
import { GameState, Player, CardColor } from './types.js';
import { createFullDeck, AVATARS } from './constants.js';
import { canPlayCard, getNextTurnIndex, shuffle } from './gameLogic.js';
import Lobby from './components/Lobby.js';
import GameBoard from './components/GameBoard.js';
import MusicPlayer from './components/MusicPlayer.js';

const App: React.FC = () => {
  const [user, setUser] = useState<{ id: string; name: string; avatarUrl: string } | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('uno_player_id');
    const id = savedId || Math.random().toString(36).substr(2, 9);
    if (!savedId) localStorage.setItem('uno_player_id', id);
    
    const savedName = localStorage.getItem('uno_player_name') || `Player_${id.substr(0, 4)}`;
    const savedAvatar = localStorage.getItem('uno_player_avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)];
    
    setUser({ id, name: savedName, avatarUrl: savedAvatar });
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const unsub = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data() as GameState);
      } else {
        setError('Room closed');
        setRoomId(null);
      }
    });

    return () => unsub();
  }, [roomId]);

  const handleAvatarChange = (url: string) => {
    if (!user) return;
    const updatedUser = { ...user, avatarUrl: url };
    setUser(updatedUser);
    localStorage.setItem('uno_player_avatar', url);
  };

  const handleCreateRoom = async (name: string) => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const newPlayer: Player = { id: user!.id, name, avatarUrl: user!.avatarUrl, hand: [], isUno: false, ready: true };
    
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
      logs: [`✨ ${name} created match ${newRoomId}`]
    };

    try {
      await setDoc(doc(db, 'rooms', newRoomId), initialState);
      setRoomId(newRoomId);
      localStorage.setItem('uno_player_name', name);
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleJoinRoom = async (code: string, name: string) => {
    const roomRef = doc(db, 'rooms', code);
    const docSnap = await getDoc(roomRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as GameState;
      if (data.status !== 'lobby') {
        setError('Match in progress');
        return;
      }
      if (data.players.length >= 6) {
        setError('Match full');
        return;
      }

      const newPlayer: Player = { id: user!.id, name, avatarUrl: user!.avatarUrl, hand: [], isUno: false, ready: true };
      await updateDoc(roomRef, {
        players: [...data.players, newPlayer],
        logs: [...data.logs, `👋 ${name} joined`]
      });
      setRoomId(code);
      localStorage.setItem('uno_player_name', name);
    } else {
      setError('Invalid code');
    }
  };

  const startGame = async () => {
    if (!gameState || !roomId) return;
    const deck = createFullDeck();
    const players = [...gameState.players];
    players.forEach(p => { p.hand = deck.splice(0, 7); p.isUno = false; });

    let topCard = deck.pop()!;
    const numericValues = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    while (!numericValues.includes(topCard.value) || topCard.color === 'wild') {
      deck.unshift(topCard);
      topCard = deck.pop()!;
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'playing',
      players,
      drawPile: deck,
      currentCard: topCard,
      discardPile: [topCard],
      logs: [...gameState.logs, '🚀 Game Started! Initial card is ' + topCard.color + ' ' + topCard.value]
    });
  };

  const playCard = async (cardIndex: number, pickedColor?: CardColor) => {
    if (!gameState || !roomId || !user) return;
    const currentPlayer = gameState.players[gameState.turnIndex];
    if (currentPlayer.id !== user.id) return;

    const card = currentPlayer.hand[cardIndex];
    if (!canPlayCard(card, gameState.currentCard, gameState.activeColor, gameState.pendingDraw)) return;

    let newPlayers = [...gameState.players];
    newPlayers[gameState.turnIndex].hand.splice(cardIndex, 1);
    
    let nextTurn = gameState.turnIndex;
    let nextDirection = gameState.direction;
    let nextPendingDraw = gameState.pendingDraw;
    let newLogs = [...gameState.logs, `🃏 ${user.name} played ${card.color} ${card.value}`];

    if (card.value === 'skip') {
      nextTurn = getNextTurnIndex(nextTurn, newPlayers.length, nextDirection);
    } else if (card.value === 'reverse') {
      if (newPlayers.length === 2) {
        nextTurn = getNextTurnIndex(nextTurn, newPlayers.length, nextDirection);
      } else {
        nextDirection = (nextDirection === 1 ? -1 : 1) as 1 | -1;
      }
    } else if (card.value === 'draw2') nextPendingDraw += 2;
    else if (card.value === 'draw4') nextPendingDraw += 4;

    if (newPlayers[gameState.turnIndex].hand.length === 0) {
      await updateDoc(doc(db, 'rooms', roomId), { status: 'ended', winner: user.name });
      return;
    }

    nextTurn = getNextTurnIndex(nextTurn, newPlayers.length, nextDirection);

    await updateDoc(doc(db, 'rooms', roomId), {
      players: newPlayers,
      currentCard: card,
      discardPile: [card, ...gameState.discardPile],
      turnIndex: nextTurn,
      direction: nextDirection,
      pendingDraw: nextPendingDraw,
      activeColor: (card.color === 'wild' || card.value === 'draw4') ? pickedColor : null,
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

    if (newDrawPile.length <= Math.max(1, gameState.pendingDraw)) {
      const top = newDiscardPile.shift()!;
      newDrawPile = shuffle([...newDiscardPile]);
      newDiscardPile = [top];
    }

    const cardsToDrawCount = gameState.pendingDraw || 1;
    newPlayers[gameState.turnIndex].hand.push(...newDrawPile.splice(0, cardsToDrawCount));
    newPlayers[gameState.turnIndex].isUno = false;

    const nextTurn = getNextTurnIndex(gameState.turnIndex, newPlayers.length, gameState.direction);

    await updateDoc(doc(db, 'rooms', roomId), {
      players: newPlayers,
      drawPile: newDrawPile,
      discardPile: newDiscardPile,
      pendingDraw: 0,
      turnIndex: nextTurn,
      logs: [...gameState.logs, `📥 ${user.name} drew ${cardsToDrawCount}`]
    });
  };

  const handleUno = async () => {
    if (!gameState || !roomId || !user) return;
    const idx = gameState.players.findIndex(p => p.id === user.id);
    const newPlayers = [...gameState.players];
    newPlayers[idx].isUno = true;
    await updateDoc(doc(db, 'rooms', roomId), { players: newPlayers, logs: [...gameState.logs, `📣 ${user.name} UNO!`] });
  };

  if (!user) return null;

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/20 to-blue-500/20 pointer-events-none"></div>
        <h1 className="text-8xl uno-font text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.5)] mb-12 animate-pulse">UNO</h1>
        <button 
          onClick={() => setHasStarted(true)}
          className="group relative px-12 py-6 bg-white rounded-full overflow-hidden transition-all hover:scale-110 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="relative text-2xl font-black text-slate-900 group-hover:text-white uppercase tracking-[0.2em]">Enter Wave Station</span>
        </button>
        <p className="mt-8 text-white/40 font-black uppercase tracking-widest text-xs">Unlock Audio & Visuals</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-start overflow-hidden relative">
      <header className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
        <h1 className="text-4xl uno-font text-red-600 drop-shadow-lg select-none">UNO</h1>
        <p className="text-white font-black tracking-widest uppercase text-[10px] opacity-80">World Pro</p>
      </header>

      {error && (
        <div className="fixed top-8 right-8 bg-red-600/90 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] animate-bounce flex items-center border-2 border-white/20">
          <span className="font-bold text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-4">✕</button>
        </div>
      )}

      {!roomId ? (
        <Lobby 
          userName={user.name} 
          currentAvatar={user.avatarUrl}
          onAvatarChange={handleAvatarChange}
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
      ) : null}

      <MusicPlayer autoPlay={true} />
    </div>
  );
};

export default App;