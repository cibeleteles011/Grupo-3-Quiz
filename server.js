const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 10 * 1024 * 1024 });

app.use(express.json({ limit: '10mb' }));

// Redireciona raiz antes de qualquer middleware estático
app.get('/', (req, res) => {
  res.redirect('/host');
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'join.html'));
});

app.get('/quiz', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

app.get('/result', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'result.html'));
});

// Servir arquivos estáticos do diretório do projeto (para style.css e imagens) e da pasta public
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));

// API para listar avatares disponíveis
app.get('/api/avatars', (req, res) => {
  const dir = path.join(__dirname, 'avatars');
  fs.readdir(dir, (err, files) => {
    if (err) return res.json({ ok: true, avatars: [] });
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp']);
    const list = files
      .filter(f => allowed.has(path.extname(f).toLowerCase()))
      .map(f => `/avatars/${f}`);
    res.json({ ok: true, avatars: list });
  });
});

// Importação em massa de perguntas via HTTP
app.post('/api/questions', (req, res) => {
  const { pin, questions } = req.body || {};
  const room = roomByPin(String(pin || ''));
  if (!room) return res.status(400).json({ ok: false, error: 'PIN inválido' });
  if (!Array.isArray(questions)) return res.status(400).json({ ok: false, error: 'questions deve ser um array' });
  const valids = questions.filter(q => q && q.question && Array.isArray(q.answers) && q.answers.length === 4 && Number.isInteger(q.correct) && q.correct >=0 && q.correct <=3);
  room.questions = valids;
  io.to(pin).emit('lobby:questionsUpdated', { count: room.questions.length });
  return res.json({ ok: true, count: valids.length });
});

function genPin() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

// Estrutura em memória
const rooms = new Map();
// rooms.set(pin, {
//   hostId, players: Map(socketId => {name, score}),
//   questions: [{question, answers:[a,b,c,d], correct:0}],
//   currentIndex: -1,
//   state: 'lobby' | 'running' | 'finished',
//   startAt: 0,
//   duration: 30,
//   questionTimer: null,
//   answered: Set(socketId),
//   answers: Map(socketId => { answerIndex, time })
// })

function roomByPin(pin) {
  return rooms.get(pin);
}

io.on('connection', (socket) => {
  // Host cria sala
  socket.on('host:createRoom', () => {
    let pin;
    do { pin = genPin(); } while (rooms.has(pin));
    rooms.set(pin, {
      hostId: socket.id,
      players: new Map(),
      keys: new Map(),
      questions: [],
      currentIndex: -1,
      state: 'lobby',
      revealing: false
    });
    socket.join(pin);
    socket.emit('host:roomCreated', { pin, joinUrl: `/join?pin=${pin}` });
  });

  // Host adiciona perguntas
  socket.on('host:addQuestions', ({ pin, questions }) => {
    const room = roomByPin(pin);
    if (!room || room.hostId !== socket.id) return;
    if (!Array.isArray(questions)) return;
    room.questions = questions.filter(q => q && q.question && Array.isArray(q.answers) && q.answers.length === 4 && Number.isInteger(q.correct));
    io.to(pin).emit('lobby:questionsUpdated', { count: room.questions.length });
  });

  // Jogador entra
  socket.on('player:join', ({ pin, name, avatar }, ack) => {
    const room = roomByPin(pin);
    if (!room) return ack && ack({ ok: false, error: 'PIN inválido' });
    if (room.state !== 'lobby') return ack && ack({ ok: false, error: 'Jogo já iniciado' });
    const key = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const player = { name: String(name || 'Jogador'), score: 0, avatar: avatar || '', key, lastResult: null };
    room.players.set(socket.id, player);
    room.keys.set(key, socket.id);
    socket.join(pin);
    ack && ack({ ok: true, pin, name: player.name, key });
    io.to(room.hostId).emit('lobby:playerList', Array.from(room.players.values()));
  });

  // Jogador retorna após trocar de página e reassocia o socket ao mesmo jogador
  socket.on('player:resume', ({ pin, key }, ack) => {
    const room = roomByPin(pin);
    if (!room) return ack && ack({ ok: false, error: 'PIN inválido' });
    const oldSocketId = room.keys.get(key);
    let player = null;
    if (oldSocketId && room.players.has(oldSocketId)) {
      player = room.players.get(oldSocketId);
      room.players.delete(oldSocketId);
    } else {
      // chave conhecida mas sem player? criar placeholder para não perder sessão
      player = { name: 'Jogador', score: 0, avatar: '', key, lastResult: null };
    }
    room.players.set(socket.id, player);
    room.keys.set(key, socket.id);
    socket.join(pin);
    ack && ack({ ok: true, name: player.name, score: player.score });
    // se o jogo já estiver em andamento e não estiver em revelação, envia a pergunta atual
    if (room.state === 'running' && room.currentIndex >= 0 && !room.revealing) {
      const q = room.questions[room.currentIndex];
      if (q) {
        socket.emit('game:question', {
          index: room.currentIndex,
          total: room.questions.length,
          question: q.question,
          answers: q.answers,
          startAt: room.startAt,
          duration: room.duration
        });
      }
    }
  });

  // Fornece último resultado para a página de resultados
  socket.on('player:getLastResult', ({ pin, key }, ack) => {
    const room = roomByPin(pin);
    if (!room) return ack && ack({ ok: false });
    const sid = room.keys.get(key);
    if (!sid) return ack && ack({ ok: false });
    const player = room.players.get(sid);
    if (!player) return ack && ack({ ok: false });
    ack && ack({ ok: true, lastResult: player.lastResult });
  });

  // Host inicia jogo
  socket.on('host:startGame', ({ pin }) => {
    const room = roomByPin(pin);
    if (!room || room.hostId !== socket.id) return;
    if (!room.questions.length) {
      room.questions = [
        { question: 'Pergunta exemplo 1?', answers: ['A', 'B', 'C', 'D'], correct: 0 },
        { question: 'Pergunta exemplo 2?', answers: ['A', 'B', 'C', 'D'], correct: 1 }
      ];
    }
    room.state = 'running';
    room.currentIndex = 0;
    room.duration = 30; // segundos
    io.to(pin).emit('game:started');
    sendCurrentQuestion(pin);
  });

  // Jogador responde
  socket.on('player:answer', ({ pin, answerIndex }, ack) => {
    const room = roomByPin(pin);
    if (!room || room.state !== 'running') return;
    const player = room.players.get(socket.id);
    if (!player) return;
    // Evita múltiplas respostas por pergunta
    room.answered = room.answered || new Set();
    if (room.answered.has(socket.id)) {
      return ack && ack({ ok: true, repeated: true, correct: false, score: player.score, delta: 0 });
    }
    room.answers = room.answers || new Map();
    room.answers.set(socket.id, { answerIndex: Number(answerIndex), time: Date.now() });
    room.answered.add(socket.id);
    // atualizar progresso para o host
    // calcular jogadores ativos conectados (exclui host e fantasmas)
    const roomSet = io.sockets.adapter.rooms.get(pin) || new Set();
    const active = new Set(
      Array.from(roomSet).filter(id => id !== room.hostId && room.players.has(id))
    );
    io.to(room.hostId).emit('game:progress', { answered: Array.from(active).filter(id => room.answered.has(id)).length, total: active.size });
    ack && ack({ ok: true });
    // Se todos jogadores responderam, revela automaticamente
    const allAnswered = Array.from(active).every(id => room.answered.has(id));
    if (active.size > 0 && allAnswered) revealAndScore(pin);
  });

  // Host avança questão
  socket.on('host:nextQuestion', ({ pin }) => {
    const room = roomByPin(pin);
    if (!room || room.hostId !== socket.id) return;
    if (room.currentIndex < room.questions.length - 1) {
      if (room.questionTimer) { clearTimeout(room.questionTimer); room.questionTimer = null; }
      room.currentIndex += 1;
      sendCurrentQuestion(pin);
    } else {
      room.state = 'finished';
      const leaderboard = Array.from(room.players.values()).sort((a,b)=>b.score-a.score);
      io.to(pin).emit('game:finished', { leaderboard });
    }
  });

  socket.on('disconnect', () => {
    // Remover jogador de qualquer sala
    for (const [pin, room] of rooms) {
      if (room.hostId === socket.id) {
        // Host saiu: encerrar sala
        io.to(pin).emit('room:closed');
        rooms.delete(pin);
        break;
      }
      // Para jogadores, não removemos imediatamente para permitir resume entre páginas
    }
  });

  function sendCurrentQuestion(pin) {
    const room = roomByPin(pin);
    if (!room) return;
    const q = room.questions[room.currentIndex];
    // inicia timer da pergunta
    room.startAt = Date.now();
    room.answered = new Set();
    room.answers = new Map();
    room.revealing = false;
    if (room.questionTimer) { clearTimeout(room.questionTimer); }
    room.questionTimer = setTimeout(() => {
      // tempo esgotado -> host pode avançar
      if (room && room.state === 'running') {
        io.to(pin).emit('game:timeup');
        // ao estourar o tempo, revelar automaticamente
        revealAndScore(pin);
      }
    }, (room.duration || 30) * 1000);
    const payload = {
      index: room.currentIndex,
      total: room.questions.length,
      question: q.question,
      answers: q.answers,
      startAt: room.startAt,
      duration: room.duration
    };
    io.to(pin).emit('game:question', payload);
    // reenvio após pequeno atraso apenas se não estiver em revelação
    setTimeout(() => {
      const r = roomByPin(pin);
      if (r && r.state === 'running' && !r.revealing && r.currentIndex === payload.index) {
        io.to(pin).emit('game:question', payload);
      }
    }, 200);
    // envia progresso inicial (0/n) considerando ativos
    const roomSet = io.sockets.adapter.rooms.get(pin) || new Set();
    const active = new Set(Array.from(roomSet).filter(id => id !== room.hostId && room.players.has(id)));
    io.to(room.hostId).emit('game:progress', { answered: 0, total: active.size });
  }

  function revealAndScore(pin) {
    const room = roomByPin(pin);
    if (!room || room.state !== 'running') return;
    room.revealing = true;
    if (room.questionTimer) { clearTimeout(room.questionTimer); room.questionTimer = null; }
    const q = room.questions[room.currentIndex];
    const duration = room.duration || 30;
    const startAt = room.startAt || Date.now();
    // pontuar todos que responderam
    for (const [socketId, player] of room.players) {
      const ans = room.answers && room.answers.get(socketId);
      let delta = 0;
      if (ans) {
        const correct = q.correct === Number(ans.answerIndex);
        const elapsed = Math.max(0, Math.floor((ans.time - startAt) / 1000));
        const remaining = Math.max(0, duration - elapsed);
        delta = correct ? Math.max(0, Math.floor(1000 * (remaining / duration))) : 0;
        player.score += delta;
        // enviar resultado individual
        const leaderboard = Array.from(room.players.values())
          .map(p => ({ name: p.name, score: p.score, avatar: p.avatar }))
          .sort((a,b)=>b.score-a.score)
          .slice(0,5);
        const payload = { correct, delta, total: player.score, top5: leaderboard, questionIndex: room.currentIndex };
        player.lastResult = payload;
        io.to(socketId).emit('player:result', payload);
      } else {
        // não respondeu: envia delta 0
        const leaderboard = Array.from(room.players.values())
          .map(p => ({ name: p.name, score: p.score, avatar: p.avatar }))
          .sort((a,b)=>b.score-a.score)
          .slice(0,5);
        const payload = { correct: false, delta: 0, total: player.score, top5: leaderboard, questionIndex: room.currentIndex };
        player.lastResult = payload;
        io.to(socketId).emit('player:result', payload);
      }
    }
    // atualizar placar para o host
    io.to(room.hostId).emit('game:scoreUpdate', Array.from(room.players.values()));
    io.to(pin).emit('reveal:shown');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
