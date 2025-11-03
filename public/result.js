const socket = io();

const params = new URLSearchParams(location.search);
const pin = params.get('pin') || sessionStorage.getItem('pin');
const key = params.get('key') || sessionStorage.getItem('key');

const resTitle = document.getElementById('resTitle');
const resScore = document.getElementById('resScore');
const top5El = document.getElementById('top5');
const hintEl = document.getElementById('hint');
const statusBox = document.getElementById('statusBox');
let resultShownAt = 0;
const MIN_RESULT_MS = 3000; // mínimo de 3s na tela de resultado

if (!pin || !key) {
  location.href = '/join';
}

// Reassocia o jogador à sala e busca último resultado
socket.emit('player:resume', { pin, key }, (resp) => {
  if (!(resp && resp.ok)) {
    location.href = '/join';
    return;
  }
  socket.emit('player:getLastResult', { pin, key }, (r) => {
    if (r && r.ok && r.lastResult) {
      renderResult(r.lastResult);
    } else {
      // se não houver, aguarda revelação
      if (hintEl) hintEl.textContent = 'Aguardando revelação...';
    }
  });
});

function renderResult({ correct, delta, total, top5 }) {
  resTitle.textContent = correct ? 'Acertou!' : 'Errou';
  resScore.textContent = `+${delta} (Total: ${total})`;
  if (statusBox) {
    statusBox.classList.remove('good', 'bad');
    statusBox.classList.add(correct ? 'good' : 'bad');
  }
  top5El.innerHTML = '';
  (top5 || []).forEach((p, idx) => {
    const li = document.createElement('li');
    const pos = document.createElement('span');
    pos.className = 'pos';
    pos.textContent = `${idx+1}.`;
    let avatarEl;
    if (p.avatar && typeof p.avatar === 'string' && p.avatar.startsWith('emoji:')) {
      avatarEl = document.createElement('div');
      avatarEl.className = 'avatar-emoji';
      avatarEl.textContent = p.avatar.slice(6);
    } else {
      const img = document.createElement('img');
      img.src = p.avatar || '/avatars/Avatar 1.png';
      img.onerror = () => { img.remove(); };
      avatarEl = img;
    }
    const span = document.createElement('span');
    span.textContent = `${idx+1}. ${p.name} - ${p.score}`;
    li.appendChild(pos);
    li.appendChild(avatarEl);
    li.appendChild(span);
    top5El.appendChild(li);
  });
  resultShownAt = Date.now();
}

// Se o host revelar enquanto estamos nesta página, também recebemos resultado
socket.on('player:result', (payload) => {
  renderResult(payload);
});

// Quando a próxima pergunta for enviada, voltar para a tela do quiz
socket.on('game:question', (payload) => {
  // Não voltar se for uma pergunta antiga
  if (payload && payload.startAt && resultShownAt && payload.startAt < resultShownAt) {
    return;
  }
  const now = Date.now();
  const wait = Math.max(0, MIN_RESULT_MS - (now - resultShownAt));
  const go = () => {
    sessionStorage.setItem('pin', pin);
    sessionStorage.setItem('key', key);
    location.href = `/quiz?pin=${encodeURIComponent(pin)}&key=${encodeURIComponent(key)}`;
  };
  if (wait > 0) setTimeout(go, wait); else go();
});

socket.on('game:finished', ({ leaderboard }) => {
  // Opcional: poderíamos mostrar um resumo final aqui
  // Por ora, apenas notifica e mantém na tela de resultado
  if (hintEl) hintEl.textContent = 'Jogo finalizado';
});

socket.on('room:closed', () => {
  alert('Sala encerrada.');
  location.href = '/join';
});
