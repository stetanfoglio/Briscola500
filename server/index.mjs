import express from 'express';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import {
  createNewGame,
  declarePlayerMeld,
  playPlayerCard,
  resolveCurrentTrick,
  startNextHand,
} from '../src/game.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});
const rooms = new Map();
const port = Number(process.env.PORT || 3000);

app.use(express.static(join(__dirname, '..', 'dist')));
app.get(/.*/, (_req, res) => res.sendFile(join(__dirname, '..', 'dist', 'index.html')));

io.on('connection', (socket) => {
  socket.on('createRoom', (_payload, ack) => {
    const code = createRoomCode();
    const room = {
      code,
      players: { human: socket.id, cpu: null },
      game: createNewGame(),
    };
    rooms.set(code, room);
    socket.join(code);
    ack?.({ ok: true, code, role: 'human' });
    emitRoom(room);
  });

  socket.on('joinRoom', ({ code }, ack) => {
    const normalized = String(code || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) {
      ack?.({ ok: false, error: 'Stanza non trovata.' });
      return;
    }

    if (room.players.cpu && room.players.cpu !== socket.id) {
      ack?.({ ok: false, error: 'Stanza gia piena.' });
      return;
    }

    room.players.cpu = socket.id;
    socket.join(normalized);
    ack?.({ ok: true, code: normalized, role: 'cpu' });
    emitRoom(room);
  });

  socket.on('playCard', ({ code, role, cardId }) => {
    const room = getPlayableRoom(code, socket, role);
    if (!room) return;
    room.game = playPlayerCard(room.game, role, cardId);
    emitRoom(room);
    scheduleResolve(room);
  });

  socket.on('declareMeld', ({ code, role, meldId }) => {
    const room = getPlayableRoom(code, socket, role);
    if (!room) return;
    room.game = declarePlayerMeld(room.game, role, meldId);
    emitRoom(room);
  });

  socket.on('nextHand', ({ code, role }) => {
    const room = getPlayableRoom(code, socket, role);
    if (!room) return;
    room.game = startNextHand(room.game);
    emitRoom(room);
  });

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      if (room.players.human === socket.id || room.players.cpu === socket.id) {
        emitRoom(room, 'Avversario disconnesso.');
      }
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Briscola 500 server running on http://localhost:${port}`);
});

function createRoomCode() {
  let code = '';
  do {
    code = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function getPlayableRoom(code, socket, role) {
  const room = rooms.get(String(code || '').trim().toUpperCase());
  if (!room || room.players[role] !== socket.id) {
    return null;
  }
  return room;
}

function scheduleResolve(room) {
  if (room.game.status !== 'resolving') {
    return;
  }

  setTimeout(() => {
    room.game = resolveCurrentTrick(room.game);
    emitRoom(room);
  }, 1400);
}

function emitRoom(room, message) {
  for (const role of ['human', 'cpu']) {
    const socketId = room.players[role];
    if (!socketId) continue;
    io.to(socketId).emit('gameState', {
      code: room.code,
      role,
      waiting: !room.players.cpu,
      message,
      game: redactOpponentHand(role === 'human' ? room.game : perspectiveForCpu(room.game)),
    });
  }
}

function redactOpponentHand(game) {
  return {
    ...game,
    cpuHand: game.cpuHand.map((_, index) => ({
      id: `hidden-${index}`,
      suit: 'Denari',
      rank: 'Due',
      points: 0,
      power: 0,
    })),
  };
}

function perspectiveForCpu(game) {
  return {
    ...game,
    humanHand: game.cpuHand,
    cpuHand: game.humanHand,
    table: game.table.map((played) => ({ ...played, player: swapPlayer(played.player) })),
    leader: swapPlayer(game.leader),
    turn: swapPlayer(game.turn),
    scores: swapRecord(game.scores),
    matchScores: swapRecord(game.matchScores),
    takenCards: swapRecord(game.takenCards),
    melds: game.melds.map((meld) => ({ ...meld, player: swapPlayer(meld.player) })),
    announcement: game.announcement ? { ...game.announcement, player: swapPlayer(game.announcement.player) } : undefined,
    winner: game.winner === 'draw' || !game.winner ? game.winner : swapPlayer(game.winner),
  };
}

function swapRecord(record) {
  return { human: record.cpu, cpu: record.human };
}

function swapPlayer(player) {
  return player === 'human' ? 'cpu' : 'human';
}
