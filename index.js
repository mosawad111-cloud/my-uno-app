import { initializeApp } from "firebase/app";
import { 
    getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc 
} from "firebase/firestore";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCLoJp47X5XWORmjbjgG-6mFQTZkGkyun4",
  authDomain: "my-uno-app.firebaseapp.com",
  projectId: "my-uno-app",
  storageBucket: "my-uno-app.firebasestorage.app",
  messagingSenderId: "1078453764976",
  appId: "1:1078453764976:web:a21b3c99ec3630c92d45b5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CONSTANTS ---
const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
const BG_COLORS = { red: 'bg-red-600', blue: 'bg-blue-600', green: 'bg-green-600', yellow: 'bg-yellow-400', wild: 'bg-gray-900' };
const TEXT_COLORS = { red: 'text-red-600', blue: 'text-blue-600', green: 'text-green-600', yellow: 'text-yellow-400', wild: 'text-gray-900' };

// --- STATE ---
let user = { id: '', name: '' };
let roomId = null;
let gameState = null;
let showColorPickerFor = null; // Card index

// Initialize User
const initUser = () => {
    let id = localStorage.getItem('uno_player_id');
    if (!id) {
        id = Math.random().toString(36).substr(2, 9);
        localStorage.setItem('uno_player_id', id);
    }
    let name = localStorage.getItem('uno_player_name') || `Player_${id.substr(0, 4)}`;
    user = { id, name };
};

// --- GAME LOGIC HELPERS ---
const createFullDeck = () => {
    const deck = [];
    COLORS.forEach(color => {
        deck.push({ id: `${color}-0`, color, value: '0' });
        for (let i = 0; i < 2; i++) {
            VALUES.slice(1).forEach(val => deck.push({ id: `${color}-${val}-${i}`, color, value: val }));
        }
    });
    for (let i = 0; i < 4; i++) {
        deck.push({ id: `wild-${i}`, color: 'wild', value: 'wild' });
        deck.push({ id: `draw4-${i}`, color: 'wild', value: 'draw4' });
    }
    return deck.sort(() => Math.random() - 0.5);
};

const canPlayCard = (card, currentCard, activeColor) => {
    if (!currentCard) return true;
    if (card.color === 'wild') return true;
    const targetColor = activeColor || currentCard.color;
    return card.color === targetColor || card.value === currentCard.value;
};

const getNextTurnIndex = (currentIndex, playerCount, direction) => {
    let next = currentIndex + direction;
    if (next >= playerCount) next = 0;
    if (next < 0) next = playerCount - 1;
    return next;
};

const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

// --- FIREBASE ACTIONS ---
window.createRoom = async (name) => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const newPlayer = { id: user.id, name, hand: [], isUno: false, ready: true };
    const initialState = {
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
    await setDoc(doc(db, 'rooms', newRoomId), initialState);
    localStorage.setItem('uno_player_name', name);
    user.name = name;
    joinRoomListener(newRoomId);
};

window.joinRoom = async (code, name) => {
    const roomRef = doc(db, 'rooms', code);
    const docSnap = await getDoc(roomRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status !== 'lobby') return alert('Game in progress');
        if (data.players.find(p => p.id === user.id)) return joinRoomListener(code); // Rejoin
        
        const newPlayer = { id: user.id, name, hand: [], isUno: false, ready: true };
        await updateDoc(roomRef, {
            players: [...data.players, newPlayer],
            logs: [...data.logs, `${name} joined!`]
        });
        localStorage.setItem('uno_player_name', name);
        user.name = name;
        joinRoomListener(code);
    } else {
        alert('Invalid code');
    }
};

const joinRoomListener = (code) => {
    roomId = code;
    onSnapshot(doc(db, 'rooms', code), (snap) => {
        if (snap.exists()) {
            gameState = snap.data();
            render();
        } else {
            roomId = null;
            gameState = null;
            render();
        }
    });
};

window.startGame = async () => {
    const deck = createFullDeck();
    const players = gameState.players.map(p => ({ ...p, hand: deck.splice(0, 7), isUno: false }));
    let topCard = deck.pop();
    while (topCard.color === 'wild') { deck.unshift(topCard); topCard = deck.pop(); }
    
    await updateDoc(doc(db, 'rooms', roomId), {
        status: 'playing',
        players,
        drawPile: deck,
        currentCard: topCard,
        discardPile: [topCard],
        logs: [...gameState.logs, 'Game started!']
    });
};

window.playCard = async (idx, pickedColor = null) => {
    if (gameState.players[gameState.turnIndex].id !== user.id) return;
    const card = gameState.players[gameState.turnIndex].hand[idx];
    if (!canPlayCard(card, gameState.currentCard, gameState.activeColor)) return;

    const players = [...gameState.players];
    const me = players[gameState.turnIndex];
    me.hand.splice(idx, 1);

    if (me.hand.length === 0) {
        return updateDoc(doc(db, 'rooms', roomId), { status: 'ended', winner: me.name });
    }

    let nextTurn = gameState.turnIndex;
    let nextDir = gameState.direction;
    let nextDraw = gameState.pendingDraw;

    if (card.value === 'skip') nextTurn = getNextTurnIndex(nextTurn, players.length, nextDir);
    else if (card.value === 'reverse') players.length === 2 ? (nextTurn = getNextTurnIndex(nextTurn, 2, nextDir)) : (nextDir *= -1);
    else if (card.value === 'draw2') nextDraw += 2;
    else if (card.value === 'draw4') nextDraw += 4;

    nextTurn = getNextTurnIndex(nextTurn, players.length, nextDir);

    await updateDoc(doc(db, 'rooms', roomId), {
        players,
        currentCard: card,
        discardPile: [card, ...gameState.discardPile],
        turnIndex: nextTurn,
        direction: nextDir,
        pendingDraw: nextDraw,
        activeColor: card.color === 'wild' ? pickedColor : null,
        logs: [...gameState.logs, `${me.name} played ${card.color} ${card.value}`]
    });
};

window.drawCard = async () => {
    if (gameState.players[gameState.turnIndex].id !== user.id) return;
    const count = gameState.pendingDraw || 1;
    let drawPile = [...gameState.drawPile];
    let discardPile = [...gameState.discardPile];

    if (drawPile.length <= count) {
        const top = discardPile.shift();
        drawPile = shuffle([...discardPile]);
        discardPile = [top];
    }

    const drawn = drawPile.splice(0, count);
    const players = [...gameState.players];
    players[gameState.turnIndex].hand.push(...drawn);
    players[gameState.turnIndex].isUno = false;

    const nextTurn = getNextTurnIndex(gameState.turnIndex, players.length, gameState.direction);

    await updateDoc(doc(db, 'rooms', roomId), {
        players,
        drawPile,
        discardPile,
        pendingDraw: 0,
        turnIndex: nextTurn,
        logs: [...gameState.logs, `${user.name} drew ${count} card(s)`]
    });
};

window.sayUno = async () => {
    const idx = gameState.players.findIndex(p => p.id === user.id);
    const players = [...gameState.players];
    players[idx].isUno = true;
    await updateDoc(doc(db, 'rooms', roomId), { players, logs: [...gameState.logs, `${user.name} shouted UNO!`] });
};

// --- UI COMPONENTS (HTML STRINGS) ---
const CardUI = (card, isBack = false, size = 'md', disabled = false, idx = null) => {
    const sizeMap = { sm: 'w-10 h-16 text-xs', md: 'w-20 h-32 text-xl', lg: 'w-24 h-40 text-2xl' };
    const label = (v) => {
        if (v === 'skip') return '⊘'; if (v === 'reverse') return '⇄';
        if (v === 'draw2') return '+2'; if (v === 'draw4') return '+4';
        return v === 'wild' ? 'W' : v;
    };

    if (isBack) {
        return `<div class="${sizeMap[size]} bg-red-700 border-2 border-white rounded-lg shadow-lg flex items-center justify-center overflow-hidden">
            <span class="text-white uno-font opacity-30 transform -rotate-45">UNO</span>
        </div>`;
    }

    const onclick = disabled ? '' : `onclick="handleCardClick(${idx})"`;

    return `<div ${onclick} class="${sizeMap[size]} ${BG_COLORS[card.color]} border-2 border-white rounded-lg shadow-xl flex flex-col items-center justify-center relative transition-transform hover:-translate-y-2 cursor-pointer">
        <div class="absolute top-1 left-1 text-[8px] font-bold text-white">${label(card.value)}</div>
        <div class="w-4/5 h-2/3 bg-white/20 rounded-[50%] flex items-center justify-center shadow-inner">
            <span class="uno-font text-white drop-shadow-md">${label(card.value)}</span>
        </div>
        <div class="absolute bottom-1 right-1 text-[8px] font-bold text-white rotate-180">${label(card.value)}</div>
    </div>`;
};

window.handleCardClick = (idx) => {
    const card = gameState.players[gameState.turnIndex].hand[idx];
    if (card.color === 'wild') {
        showColorPickerFor = idx;
        render();
    } else {
        window.playCard(idx);
    }
};

// --- MAIN RENDERER ---
const render = () => {
    const app = document.getElementById('app');
    
    if (!roomId) {
        app.innerHTML = `
            <div class="mt-12 flex flex-col items-center">
                <h1 class="text-7xl uno-font text-red-600 drop-shadow-lg mb-8">UNO</h1>
                <div class="w-full max-w-sm bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 animate-draw">
                    <div class="space-y-4">
                        <input id="nameInput" type="text" value="${user.name}" class="w-full bg-slate-700 p-4 rounded-xl border border-slate-600 text-white font-bold" placeholder="Your Name">
                        <button onclick="window.createRoom(document.getElementById('nameInput').value)" class="w-full bg-gradient-to-r from-red-600 to-orange-500 p-4 rounded-xl font-black uppercase tracking-widest shadow-lg">Create Room</button>
                        <div class="flex items-center space-x-2 py-2"><hr class="flex-grow border-slate-700"><span class="text-slate-500 font-bold">OR</span><hr class="flex-grow border-slate-700"></div>
                        <input id="codeInput" type="text" maxlength="4" class="w-full bg-slate-700 p-4 rounded-xl border border-slate-600 text-white text-center text-2xl font-black tracking-widest" placeholder="4-DIGIT CODE">
                        <button onclick="window.joinRoom(document.getElementById('codeInput').value, document.getElementById('nameInput').value)" class="w-full bg-green-600 p-4 rounded-xl font-black uppercase tracking-widest shadow-lg">Join Room</button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    if (gameState.status === 'lobby') {
        app.innerHTML = `
            <div class="w-full max-w-2xl bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center animate-draw mt-10">
                <h2 class="text-3xl font-black mb-2">Room: <span class="text-green-500">${gameState.roomId}</span></h2>
                <p class="text-slate-400 mb-8">Invite your friends using this code!</p>
                <div class="grid grid-cols-2 gap-4 mb-8">
                    ${gameState.players.map(p => `
                        <div class="bg-slate-700 p-4 rounded-xl flex items-center space-x-3">
                            <div class="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
                            <span class="font-bold truncate">${p.name} ${p.id === user.id ? '<span class="text-[8px] bg-blue-600 px-1 rounded ml-1">YOU</span>' : ''}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex space-x-4">
                    <button onclick="location.reload()" class="flex-1 bg-slate-700 p-4 rounded-xl font-bold">Leave</button>
                    ${gameState.players[0].id === user.id ? `
                        <button onclick="window.startGame()" ${gameState.players.length < 2 ? 'disabled' : ''} class="flex-1 bg-green-600 p-4 rounded-xl font-black disabled:opacity-50">Start Game</button>
                    ` : '<p class="flex-1 text-slate-500 italic mt-4">Waiting for host to start...</p>'}
                </div>
            </div>
        `;
        return;
    }

    if (gameState.status === 'ended') {
        app.innerHTML = `<div class="text-center mt-20 animate-draw">
            <h1 class="text-7xl uno-font text-yellow-400 mb-4">WINNER!</h1>
            <p class="text-4xl font-black mb-10">${gameState.winner}</p>
            <button onclick="location.reload()" class="bg-blue-600 px-10 py-4 rounded-xl font-black text-xl">BACK TO LOBBY</button>
        </div>`;
        return;
    }

    // GAME INTERFACE
    const me = gameState.players.find(p => p.id === user.id);
    const isMyTurn = gameState.players[gameState.turnIndex].id === user.id;

    app.innerHTML = `
        <div class="w-full flex flex-col items-center h-[90vh] justify-between">
            <!-- Opponents -->
            <div class="flex space-x-6">
                ${gameState.players.filter(p => p.id !== user.id).map(p => `
                    <div class="flex flex-col items-center opacity-80 ${gameState.players[gameState.turnIndex].id === p.id ? 'opacity-100 scale-110' : ''}">
                        <div class="relative w-12 h-12 bg-slate-800 rounded-full border-2 ${gameState.players[gameState.turnIndex].id === p.id ? 'border-yellow-400' : 'border-slate-700'} flex items-center justify-center">
                            <span class="font-bold">${p.name[0]}</span>
                            <div class="absolute -bottom-2 -right-2 bg-red-600 text-[8px] px-1.5 rounded-full border border-white font-bold">${p.hand.length}</div>
                        </div>
                        <span class="text-[10px] mt-2 text-slate-400 font-bold">${p.name}</span>
                    </div>
                `).join('')}
            </div>

            <!-- Center Table -->
            <div class="flex items-center space-x-12 relative">
                <!-- Direction Indicator -->
                <div class="absolute inset-0 w-64 h-64 border-2 border-dashed border-slate-700/30 rounded-full animate-spin-slow m-auto ${gameState.direction === -1 ? 'rotate-180' : ''}"></div>
                
                <div class="z-10 cursor-pointer" onclick="window.drawCard()">
                    ${CardUI({color:'red', value:''}, true, 'lg')}
                    <p class="text-[10px] text-center mt-2 text-slate-500 font-bold">DRAW (${gameState.drawPile.length})</p>
                </div>
                
                <div class="z-10 relative">
                    ${CardUI(gameState.currentCard, false, 'lg', true)}
                    ${gameState.activeColor ? `<div class="absolute -top-3 -right-3 w-8 h-8 rounded-full border-2 border-white ${BG_COLORS[gameState.activeColor]} shadow-lg"></div>` : ''}
                    <p class="text-[10px] text-center mt-2 text-slate-500 font-bold">DISCARD</p>
                </div>
            </div>

            <!-- Say UNO -->
            ${isMyTurn && me.hand.length === 2 && !me.isUno ? `
                <button onclick="window.sayUno()" class="bg-yellow-400 text-black px-8 py-3 rounded-full font-black text-xs animate-bounce border-2 border-black">SAY UNO!</button>
            ` : ''}

            <!-- Player Hand -->
            <div class="w-full bg-slate-800/50 p-6 rounded-t-[50px] border-t-4 ${isMyTurn ? 'border-green-500' : 'border-slate-700'}">
                <div class="flex justify-between items-center mb-4 px-4">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">${isMyTurn ? 'Your Turn' : "Wait..."}</span>
                    ${me.isUno ? '<span class="text-[8px] bg-yellow-400 text-black px-2 py-1 rounded font-black">UNO!</span>' : ''}
                </div>
                <div class="flex justify-center -space-x-8 overflow-x-auto pb-6">
                    ${me.hand.map((c, i) => `
                        <div class="card-stack animate-draw" style="animation-delay: ${i * 0.05}s">
                            ${CardUI(c, false, 'md', !isMyTurn, i)}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Color Picker Modal -->
        ${showColorPickerFor !== null ? `
            <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
                <div class="bg-slate-800 p-8 rounded-3xl border-2 border-slate-700 text-center max-w-xs w-full">
                    <h3 class="text-xl font-black mb-6 italic uppercase">Pick Color</h3>
                    <div class="grid grid-cols-2 gap-4">
                        ${COLORS.map(c => `
                            <button onclick="window.playCard(${showColorPickerFor}, '${c}'); showColorPickerFor=null;" class="w-full aspect-square rounded-2xl ${BG_COLORS[c]} border-4 border-white/20 transition-transform hover:scale-110"></button>
                        `).join('')}
                    </div>
                    <button onclick="showColorPickerFor=null; render();" class="mt-6 text-slate-500 font-bold">Cancel</button>
                </div>
            </div>
        ` : ''}

        <!-- Logs (Desktop) -->
        <div class="hidden lg:block fixed left-6 bottom-6 w-56 h-32 bg-slate-900/80 rounded-xl p-3 border border-slate-800 overflow-y-auto text-[10px] text-slate-500">
            ${gameState.logs.slice().reverse().map(l => `<div class="mb-1">▸ ${l}</div>`).join('')}
        </div>
    `;
};

// Start
initUser();
render();