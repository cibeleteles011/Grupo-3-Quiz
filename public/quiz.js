const socket = io();

// Recupera pin e key da URL ou do storage
const params = new URLSearchParams(location.search);
const pin = params.get('pin') || sessionStorage.getItem('pin');
const key = params.get('key') || sessionStorage.getItem('key');

const qHeader = document.getElementById('qHeader');
const qText = document.getElementById('qText');
const ansBtns = [0,1,2,3].map(i => document.getElementById(`ans${i}`));
const gameEl = document.getElementById('game');
const countdownEl = document.getElementById('countdown');
let countdownInterval = null;
let answeredThisQuestion = false;
let selectedIndex = null;

if (!pin || !key) {
  // sem contexto, volta para join
  location.href = '/join';
}

function startCountdown(startAt, duration) {
  if (!countdownEl) return;
  clearCountdown();
  const d = Number(duration) || 30;
  const sAt = Number(startAt) || Date.now();
  const tick = () => {
    const elapsed = Math.floor((Date.now() - sAt) / 1000);
    const remaining = Math.max(0, d - elapsed);
    countdownEl.textContent = String(remaining);
    if (remaining <= 0) clearCountdown();
  };
  tick();
  countdownInterval = setInterval(tick, 500);
}

function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// Reassocia o jogador à sala
socket.emit('player:resume', { pin, key }, (resp) => {
  if (!(resp && resp.ok)) {
    location.href = '/join';
    return;
  }
});

socket.on('game:question', ({ index, total, question, answers, startAt, duration }) => {
  gameEl.style.display = 'block';
  answeredThisQuestion = false;
  selectedIndex = null;
  qHeader.textContent = `Pergunta ${index+1}/${total}`;
  qText.textContent = question;
  // limpar estados visuais anteriores
  ansBtns.forEach(b => {
    b.classList.remove('selected', 'waiting');
  });
  answers.forEach((txt, i) => {
    ansBtns[i].textContent = txt;
    ansBtns[i].onclick = () => {
      if (answeredThisQuestion) return;
      answeredThisQuestion = true;
      selectedIndex = i;
      // aplicar destaque visual na resposta escolhida e estado de espera nas demais
      ansBtns.forEach((b, idx) => {
        if (idx === i) {
          b.classList.add('selected');
        } else {
          b.classList.add('waiting');
        }
      });
      socket.emit('player:answer', { pin, answerIndex: i }, (ack) => {
        // aguarda revelação do host ou todos responderem
        ansBtns.forEach(b => b.disabled = true);
      });
    };
  });
  ansBtns.forEach(b => b.disabled = false);
  startCountdown(startAt, duration);
});

socket.on('player:result', (payload) => {
  // redireciona para a página de resultado, mantendo contexto
  sessionStorage.setItem('pin', pin);
  sessionStorage.setItem('key', key);
  location.href = `/result?pin=${encodeURIComponent(pin)}&key=${encodeURIComponent(key)}`;
});

socket.on('room:closed', () => {
  alert('Sala encerrada.');
  location.href = '/join';
});
