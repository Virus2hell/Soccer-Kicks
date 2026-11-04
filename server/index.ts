// Game server: accounts, profiles and online matches over Socket.IO.
// Online matches run on the server with the SAME rules code as the app
// (src/game/match.ts), so both players always see the same game.
//
// Start it with:  cd server && npm install && npm start

import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Server, Socket } from 'socket.io';

import { Db } from './db';
import { isPuckColor } from '../src/game/colors';
import { FORMATION_IDS } from '../src/game/formations';
import {
  MatchInput,
  MatchState,
  SideSetup,
  applyInput,
  createMatch,
  matchResultFor,
  update,
} from '../src/game/match';
import { MAX_LEVEL, MAX_NAME_LENGTH, matchReward, upgradeCost } from '../src/game/pucks';
import {
  GOAL_OPTIONS,
  MatchResult,
  MatchSettings,
  Profile,
  STAT_KEYS,
  StatKey,
  TIME_OPTIONS,
  Team,
} from '../src/game/types';

const PORT = Number(process.env.PORT ?? 3001);
const SEND_EVERY_MS = 33; // ~30 updates per second to the phones

const db = new Db(path.join(__dirname, 'data', 'db.json'));
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Soccer Pucks server is running');
});
const io = new Server(httpServer, { cors: { origin: '*' } });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Ack = (res: object) => void;
type Handler = (payload: any) => object | void;

function handle(socket: Socket, event: string, fn: Handler) {
  socket.on(event, (payload: unknown, ack?: Ack) => {
    try {
      const res = fn(payload ?? {});
      ack?.({ ok: true, ...(res ?? {}) });
    } catch (e) {
      ack?.({ ok: false, error: e instanceof Error ? e.message : 'Something went wrong' });
    }
  });
}

function applyResult(profile: Profile, result: MatchResult) {
  const goalsFor = Math.max(0, Math.min(99, Math.floor(result.goalsFor)));
  const goalsAgainst = Math.max(0, Math.min(99, Math.floor(result.goalsAgainst)));

  profile.stats.played += 1;
  if (result.won) profile.stats.wins += 1;
  else profile.stats.losses += 1;
  if (result.won && result.wonOnShootout) profile.stats.shootoutWins += 1;
  profile.stats.goals += goalsFor;
  profile.stats.conceded += goalsAgainst;

  for (const puck of profile.pucks) {
    const s = result.puckStats?.[puck.id];
    if (!s) continue;
    puck.goals += Math.max(0, Math.min(99, Math.floor(s.goals || 0)));
    puck.shots += Math.max(0, Math.min(999, Math.floor(s.shots || 0)));
    if (s.played) puck.matches += 1;
  }

  const reward = matchReward(!!result.won, goalsFor);
  profile.coins += reward;
  db.save();
  return reward;
}

function validSettings(s: any): MatchSettings {
  if (s?.mode === 'time' && TIME_OPTIONS.includes(s.minutes)) return { mode: 'time', minutes: s.minutes, goals: 0 };
  if (s?.mode === 'goals' && GOAL_OPTIONS.includes(s.goals)) return { mode: 'goals', minutes: 0, goals: s.goals };
  throw new Error('Invalid match settings');
}

const sideSetup = (p: Profile): SideSetup => ({
  name: p.username,
  color: p.color,
  formation: p.formation,
  pucks: p.pucks,
  lineup: p.lineup,
});

// ---------------------------------------------------------------------------
// Rooms (online matches)
// ---------------------------------------------------------------------------

type RoomPlayer = { username: string; socketId: string };

type Room = {
  code: string;
  settings: MatchSettings;
  players: RoomPlayer[]; // [host, guest]
  match: MatchState | null;
  timer: NodeJS.Timeout | null;
  finished: boolean;
};

const rooms = new Map<string, Room>();
const roomOfSocket = new Map<string, string>();

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const roomView = (room: Room) => ({
  code: room.code,
  settings: room.settings,
  players: room.players.map((p) => p.username),
  playing: !!room.match && !room.finished,
});

function sendRoom(room: Room) {
  io.to(room.code).emit('room:update', roomView(room));
}

function snapshot(match: MatchState) {
  const { sides: _sides, ...rest } = match;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { ...rest, bodies: rest.bodies.map((b) => ({ ...b, x: r(b.x), y: r(b.y), vx: r(b.vx), vy: r(b.vy) })) };
}

function startMatch(room: Room) {
  const profiles = room.players.map((p) => db.getUser(p.username)!.profile);
  const match = createMatch(room.settings, sideSetup(profiles[0]), sideSetup(profiles[1]));
  room.match = match;
  room.finished = false;

  room.players.forEach((p, team) => io.to(p.socketId).emit('match:start', { team }));
  sendRoom(room);

  let last = Date.now();
  let lastSend = 0;
  let lastSides = '';
  room.timer = setInterval(() => {
    const now = Date.now();
    update(match, Math.min((now - last) / (1000 / 60), 4));
    last = now;

    if (now - lastSend >= SEND_EVERY_MS || match.phase === 'over') {
      lastSend = now;
      const sides = JSON.stringify(match.sides);
      if (sides !== lastSides) {
        lastSides = sides;
        io.to(room.code).emit('match:sides', match.sides);
      }
      io.to(room.code).emit('match:state', snapshot(match));
    }

    if (match.phase === 'over') finishMatch(room);
  }, 1000 / 60);
}

function finishMatch(room: Room) {
  const match = room.match;
  if (!match || room.finished) return;
  room.finished = true;
  if (room.timer) clearInterval(room.timer);
  room.timer = null;

  room.players.forEach((p, i) => {
    const team = i as Team;
    const user = db.getUser(p.username);
    if (!user) return;
    const reward = applyResult(user.profile, matchResultFor(match, team));
    io.to(p.socketId).emit('match:end', { winner: match.winner, reward });
    io.to(p.socketId).emit('profile:update', user.profile);
  });
  sendRoom(room);
}

function leaveRoom(socket: Socket) {
  const code = roomOfSocket.get(socket.id);
  if (!code) return;
  roomOfSocket.delete(socket.id);
  socket.leave(code);
  socket.emit('room:update', null);

  const room = rooms.get(code);
  if (!room) return;
  const index = room.players.findIndex((p) => p.socketId === socket.id);

  // Leaving during a match = you lose
  if (room.match && !room.finished && index !== -1) {
    room.match.phase = 'over';
    room.match.winner = index === 0 ? 1 : 0;
    io.to(room.code).emit('match:state', snapshot(room.match));
    finishMatch(room);
  }

  room.players = room.players.filter((p) => p.socketId !== socket.id);
  if (room.players.length === 0 || room.finished) {
    if (room.timer) clearInterval(room.timer);
    rooms.delete(code);
    for (const p of room.players) {
      roomOfSocket.delete(p.socketId);
      io.to(p.socketId).emit('room:update', null);
    }
  } else {
    sendRoom(room); // the guest becomes the new host
  }
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  let username: string | null = null;

  const me = () => {
    const user = username ? db.getUser(username) : undefined;
    if (!user) throw new Error('Please log in again');
    return user;
  };

  // ---- Accounts ----
  handle(socket, 'auth:register', ({ username: name, password }) => {
    const clean = String(name ?? '').trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) throw new Error('Username: 3-16 letters, numbers or _');
    if (String(password ?? '').length < 4) throw new Error('Password must be at least 4 characters');
    const user = db.createUser(clean, String(password));
    username = user.username;
    return { token: db.newToken(user), profile: user.profile };
  });

  handle(socket, 'auth:login', ({ username: name, password }) => {
    const user = db.getUser(String(name ?? '').trim());
    if (!user || !db.checkPassword(user, String(password ?? ''))) throw new Error('Wrong username or password');
    username = user.username;
    return { token: db.newToken(user), profile: user.profile };
  });

  handle(socket, 'auth:token', ({ token }) => {
    const user = db.findByToken(String(token ?? ''));
    if (!user) throw new Error('Session expired, please log in');
    username = user.username;
    return { profile: user.profile };
  });

  handle(socket, 'auth:logout', ({ token }) => {
    leaveRoom(socket);
    db.removeToken(String(token ?? ''));
    username = null;
  });

  // ---- Profile ----
  handle(socket, 'profile:get', () => ({ profile: me().profile }));

  handle(socket, 'profile:rename', ({ puckId, name }) => {
    const profile = me().profile;
    const puck = profile.pucks.find((p) => p.id === puckId);
    const clean = String(name ?? '').trim();
    if (!puck) throw new Error('Puck not found');
    if (clean.length < 1 || clean.length > MAX_NAME_LENGTH) throw new Error(`Name must be 1-${MAX_NAME_LENGTH} characters`);
    puck.name = clean;
    db.save();
    return { profile };
  });

  handle(socket, 'profile:upgrade', ({ puckId, stat }) => {
    const profile = me().profile;
    const puck = profile.pucks.find((p) => p.id === puckId);
    if (!puck || !STAT_KEYS.includes(stat)) throw new Error('Invalid upgrade');
    const level = puck.levels[stat as StatKey];
    if (level >= MAX_LEVEL) throw new Error('Already at max level');
    const cost = upgradeCost(level);
    if (profile.coins < cost) throw new Error(`You need ${cost} coins`);
    profile.coins -= cost;
    puck.levels[stat as StatKey] = level + 1;
    db.save();
    return { profile };
  });

  handle(socket, 'profile:color', ({ color }) => {
    const profile = me().profile;
    if (!isPuckColor(color)) throw new Error('Unknown color');
    profile.color = color;
    db.save();
    return { profile };
  });

  handle(socket, 'profile:formation', ({ formation }) => {
    const profile = me().profile;
    if (!FORMATION_IDS.includes(formation)) throw new Error('Unknown formation');
    profile.formation = formation;
    db.save();
    return { profile };
  });

  handle(socket, 'profile:lineup', ({ lineup }) => {
    const profile = me().profile;
    const ids = profile.pucks.map((p) => p.id).sort();
    if (!Array.isArray(lineup) || [...lineup].sort().join() !== ids.join()) throw new Error('Invalid lineup');
    profile.lineup = lineup;
    db.save();
    return { profile };
  });

  // Local (same phone) matches are played on the phone; the result is reported here
  handle(socket, 'profile:localResult', ({ result }) => {
    const profile = me().profile;
    const reward = applyResult(profile, result as MatchResult);
    return { profile, reward };
  });

  // ---- Online rooms ----
  handle(socket, 'room:create', ({ settings }) => {
    const user = me();
    leaveRoom(socket);
    const room: Room = {
      code: newCode(),
      settings: validSettings(settings),
      players: [{ username: user.username, socketId: socket.id }],
      match: null,
      timer: null,
      finished: false,
    };
    rooms.set(room.code, room);
    roomOfSocket.set(socket.id, room.code);
    socket.join(room.code);
    sendRoom(room);
    return { room: roomView(room) };
  });

  handle(socket, 'room:join', ({ code }) => {
    const user = me();
    const room = rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room || room.finished) throw new Error('Room not found');
    if (room.players.length >= 2) throw new Error('Room is full');
    if (room.players.some((p) => p.username === user.username)) throw new Error("You can't play against yourself");
    leaveRoom(socket);
    room.players.push({ username: user.username, socketId: socket.id });
    roomOfSocket.set(socket.id, room.code);
    socket.join(room.code);
    sendRoom(room);
    return { room: roomView(room) };
  });

  handle(socket, 'room:leave', () => leaveRoom(socket));

  handle(socket, 'room:start', () => {
    const room = rooms.get(roomOfSocket.get(socket.id) ?? '');
    if (!room) throw new Error('Room not found');
    if (room.players[0].socketId !== socket.id) throw new Error('Only the host can start');
    if (room.players.length < 2) throw new Error('Waiting for an opponent');
    if (room.match) throw new Error('Match already started');
    startMatch(room);
  });

  // The game screen asks for the full state when it opens
  handle(socket, 'match:sync', () => {
    const room = rooms.get(roomOfSocket.get(socket.id) ?? '');
    if (!room?.match) throw new Error('No match running');
    const team = room.players.findIndex((p) => p.socketId === socket.id);
    return { team, sides: room.match.sides, state: snapshot(room.match) };
  });

  socket.on('match:input', (payload: { input: MatchInput }) => {
    const room = rooms.get(roomOfSocket.get(socket.id) ?? '');
    if (!room?.match || room.finished || !payload?.input) return;
    const team = room.players.findIndex((p) => p.socketId === socket.id);
    if (team === 0 || team === 1) applyInput(room.match, team, payload.input);
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

httpServer.listen(PORT, () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
  console.log(`\n⚽ Soccer Pucks server running on port ${PORT}`);
  console.log('In the app, use one of these server addresses:');
  for (const ip of ips) console.log(`   http://${ip}:${PORT}`);
  console.log('');
});
