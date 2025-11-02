const socket = io();
let pin = null;
let questions = [];

const btnCreate = document.getElementById('btnCreate');
const roomInfo = document.getElementById('roomInfo');
const bulk = document.getElementById('bulk');
const btnLoad = document.getElementById('btnLoad');
const qList = document.getElementById('qList');
const qCount = document.getElementById('qCount');
const players = document.getElementById('players');
const btnStart = document.getElementById('btnStart');
const btnNext = document.getElementById('btnNext');
const btnReveal = document.getElementById('btnReveal');
const qrImg = document.getElementById('qr');
// elementos da visualização ao vivo
const liveHeader = document.getElementById('liveHeader');
const liveCountdown = document.getElementById('liveCountdown');
const liveQuestion = document.getElementById('liveQuestion');
const lAnsBtns = [0,1,2,3].map(i => document.getElementById(`lAns${i}`));
const liveTop5 = document.getElementById('liveTop5');
let liveCountdownInterval = null;

btnCreate.onclick = () => {
  socket.emit('host:createRoom');
};

socket.on('host:roomCreated', ({ pin: newPin, joinUrl }) => {
  pin = newPin;
  const absolute = `${window.location.origin}${joinUrl}`;
  roomInfo.textContent = `PIN: ${pin} | Link: ${absolute}`;
  // gerar QR com link de entrada
  if (qrImg) {
    const api = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=';
    qrImg.src = api + encodeURIComponent(absolute);
    qrImg.style.display = 'block';
  }
});

btnLoad.onclick = () => {
  if (!pin) { alert('Crie a sala primeiro.'); return; }
  let data = [];
  try {
    data = JSON.parse(bulk.value || '[]');
    if (!Array.isArray(data)) throw new Error('O conteúdo deve ser um array JSON');
  } catch (e) {
    alert('JSON inválido. Exemplo:\n[ {"question":"?","answers":["A","B","C","D"],"correct":0} ]');
    return;
  }
  questions = data.filter(q => q && q.question && Array.isArray(q.answers) && q.answers.length === 4 && Number.isInteger(q.correct));
  renderQList();
  socket.emit('host:addQuestions', { pin, questions });
};

function renderQList(){
  qList.innerHTML = '';
  questions.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'q-item';
    div.textContent = `${idx+1}. ${q.question} (correta: ${q.correct+1})`;
    qList.appendChild(div);
  });
  qCount.textContent = String(questions.length);
}

// lista sincronizada pelo servidor também

socket.on('lobby:questionsUpdated', ({ count }) => {
  qCount.textContent = String(count);
});

socket.on('lobby:playerList', (list) => {
  players.innerHTML = '';
  list.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} - ${p.score}`;
    players.appendChild(li);
  });
});

btnStart.onclick = () => {
  if (!pin) { alert('Crie a sala primeiro.'); return; }
  socket.emit('host:startGame', { pin });
};

btnNext.onclick = () => {
  if (!pin) return;
  socket.emit('host:nextQuestion', { pin });
};

if (btnReveal) {
  btnReveal.onclick = () => {
    if (!pin) return;
    socket.emit('host:reveal', { pin });
  };
}

socket.on('host:error', ({ message }) => alert(message));

socket.on('game:started', () => {
  alert('Jogo iniciado!');
});

socket.on('game:scoreUpdate', (list) => {
  players.innerHTML = '';
  list.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} - ${p.score}`;
    players.appendChild(li);
  });
  // atualiza top 5 ao vivo
  if (liveTop5) {
    const top = [...list].sort((a,b)=>b.score-a.score).slice(0,5);
    liveTop5.innerHTML = '';
    top.forEach((p, idx) => {
      const li = document.createElement('li');
      li.textContent = `${idx+1}. ${p.name} - ${p.score}`;
      liveTop5.appendChild(li);
    });
  }
});

socket.on('game:finished', ({ leaderboard }) => {
  let msg = 'Jogo finalizado!\n';
  leaderboard.forEach((p, i) => {
    msg += `${i+1}. ${p.name} - ${p.score}\n`;
  });
  alert(msg);
});

socket.on('game:question', ({ index, total, question, answers, startAt, duration }) => {
  if (liveHeader) liveHeader.textContent = `Pergunta ${index+1}/${total}`;
  if (liveQuestion) liveQuestion.textContent = question;
  if (lAnsBtns && lAnsBtns[0]) {
    answers.forEach((txt, i) => {
      if (lAnsBtns[i]) {
        lAnsBtns[i].textContent = txt;
      }
    });
  }
  startLiveCountdown(startAt, duration);
});

socket.on('game:timeup', () => {
  clearLiveCountdown();
});

function startLiveCountdown(startAt, duration) {
  if (!liveCountdown) return;
  clearLiveCountdown();
  const d = Number(duration) || 30;
  const sAt = Number(startAt) || Date.now();
  const tick = () => {
    const elapsed = Math.floor((Date.now() - sAt) / 1000);
    const remaining = Math.max(0, d - elapsed);
    liveCountdown.textContent = String(remaining);
    if (remaining <= 0) {
      clearLiveCountdown();
    }
  };
  tick();
  liveCountdownInterval = setInterval(tick, 500);
}

function clearLiveCountdown() {
  if (liveCountdownInterval) {
    clearInterval(liveCountdownInterval);
    liveCountdownInterval = null;
  }
}
