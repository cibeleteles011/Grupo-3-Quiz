const socket = io();
let pin = null;
let questions = [];

const btnCreate = document.getElementById('btnCreate');
const roomInfo = document.getElementById('roomInfo');
const bulk = document.getElementById('bulk');
const btnLoad = document.getElementById('btnLoad');
const qList = document.getElementById('qList');
const qCount = document.getElementById('qCount');
const qErrors = document.getElementById('qErrors');
const qStatus = document.getElementById('qStatus');
const players = document.getElementById('players');
const btnStart = document.getElementById('btnStart');
const btnNext = document.getElementById('btnNext');
const btnReveal = document.getElementById('btnReveal');
const qrImg = document.getElementById('qr');
const fileQuestions = document.getElementById('fileQuestions');
const btnUpload = document.getElementById('btnUpload');
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
    if (qStatus) qStatus.textContent = 'Validando perguntas...';
    data = JSON.parse(bulk.value || '[]');
    if (!Array.isArray(data)) throw new Error('O conteúdo deve ser um array JSON');
  } catch (e) {
    alert('JSON inválido. Exemplo:\n[ {"question":"?","answers":["A","B","C","D"],"correct":0} ]');
    if (qStatus) qStatus.textContent = '';
    return;
  }
  // validação detalhada
  const valids = [];
  const errors = [];
  data.forEach((q, idx) => {
    const idx1 = idx + 1;
    const reasons = [];
    if (!q || typeof q !== 'object') {
      reasons.push('estrutura inválida');
    } else {
      if (!q.question || typeof q.question !== 'string' || !q.question.trim()) reasons.push('question obrigatório (string)');
      if (!Array.isArray(q.answers)) reasons.push('answers deve ser um array');
      if (Array.isArray(q.answers) && q.answers.length !== 4) reasons.push('answers deve ter exatamente 4 itens');
      if (!Number.isInteger(q.correct)) reasons.push('correct deve ser inteiro entre 0 e 3');
      if (Number.isInteger(q.correct) && (q.correct < 0 || q.correct > 3)) reasons.push('correct fora do intervalo (0-3)');
    }
    if (reasons.length) {
      errors.push(`Q${idx1}: ${reasons.join('; ')}`);
    } else {
      valids.push(q);
    }
  });
  questions = valids;
  renderQList();
  qCount.textContent = String(questions.length);
  if (qErrors) {
    if (errors.length) {
      const maxErr = 50;
      const shown = errors.slice(0, maxErr);
      const more = errors.length - shown.length;
      qErrors.textContent = `Carregadas: ${valids.length}/${data.length}.\nProblemas (mostrando até ${maxErr}):\n- ` + shown.join('\n- ') + (more>0 ? `\n... +${more} mais` : '');
    } else {
      qErrors.textContent = `Carregadas: ${valids.length}/${data.length}. Nenhum erro.`;
    }
  }
  if (qStatus) qStatus.textContent = 'Enviando perguntas ao servidor...';
  socket.emit('host:addQuestions', { pin, questions });
  if (qStatus) setTimeout(()=>{ qStatus.textContent = 'Perguntas carregadas.'; }, 300);
};

// Upload por arquivo (.json) usando POST /api/questions
if (btnUpload) {
  btnUpload.onclick = async () => {
    if (!pin) { alert('Crie a sala primeiro.'); return; }
    if (!fileQuestions || !fileQuestions.files || !fileQuestions.files[0]) { alert('Selecione um arquivo .json'); return; }
    const file = fileQuestions.files[0];
    try {
      if (qStatus) qStatus.textContent = 'Lendo arquivo...';
      const text = await file.text();
      if (qStatus) qStatus.textContent = 'Validando perguntas do arquivo...';
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('O arquivo deve conter um array JSON');
      const valids = [];
      const errors = [];
      data.forEach((q, idx) => {
        const idx1 = idx + 1;
        const reasons = [];
        if (!q || typeof q !== 'object') {
          reasons.push('estrutura inválida');
        } else {
          if (!q.question || typeof q.question !== 'string' || !q.question.trim()) reasons.push('question obrigatório (string)');
          if (!Array.isArray(q.answers)) reasons.push('answers deve ser um array');
          if (Array.isArray(q.answers) && q.answers.length !== 4) reasons.push('answers deve ter exatamente 4 itens');
          if (!Number.isInteger(q.correct)) reasons.push('correct deve ser inteiro entre 0 e 3');
          if (Number.isInteger(q.correct) && (q.correct < 0 || q.correct > 3)) reasons.push('correct fora do intervalo (0-3)');
        }
        if (reasons.length) {
          errors.push(`Q${idx1}: ${reasons.join('; ')}`);
        } else {
          valids.push(q);
        }
      });
      questions = valids;
      renderQList();
      qCount.textContent = String(questions.length);
      if (qErrors) {
        if (errors.length) {
          const maxErr = 50; const shown = errors.slice(0, maxErr); const more = errors.length - shown.length;
          qErrors.textContent = `Carregadas: ${valids.length}/${data.length}.\nProblemas (mostrando até ${maxErr}):\n- ` + shown.join('\n- ') + (more>0 ? `\n... +${more} mais` : '');
        } else {
          qErrors.textContent = `Carregadas: ${valids.length}/${data.length}. Nenhum erro.`;
        }
      }
      if (qStatus) qStatus.textContent = 'Enviando arquivo ao servidor...';
      const resp = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, questions: valids })
      });
      const json = await resp.json();
      if (!(json && json.ok)) {
        throw new Error(json && json.error ? json.error : 'Falha ao enviar perguntas');
      }
      if (qStatus) qStatus.textContent = `Perguntas carregadas (servidor): ${json.count}.`;
    } catch (e) {
      if (qStatus) qStatus.textContent = '';
      alert('Erro ao processar arquivo: ' + e.message);
    }
  };
}

function renderQList(){
  qList.innerHTML = '';
  const maxPreview = 50;
  const preview = questions.slice(0, maxPreview);
  preview.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'q-item';
    div.textContent = `${idx+1}. ${q.question} (correta: ${q.correct+1})`;
    qList.appendChild(div);
  });
  if (questions.length > maxPreview) {
    const rest = document.createElement('div');
    rest.className = 'muted';
    rest.textContent = `... +${questions.length - maxPreview} perguntas não listadas para agilizar a página.`;
    qList.appendChild(rest);
  }
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
