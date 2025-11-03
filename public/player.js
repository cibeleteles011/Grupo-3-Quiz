const socket = io();

const pinInput = document.getElementById('pin');
const nameInput = document.getElementById('name');
const btnJoin = document.getElementById('btnJoin');
const statusEl = document.getElementById('status');
const avatarGrid = document.getElementById('avatarGrid');
let selectedAvatar = '';

// Pré-preencher PIN via query
const params = new URLSearchParams(location.search);
const pinFromUrl = params.get('pin');
if (pinFromUrl) pinInput.value = pinFromUrl;

// Carregar avatares (20 emojis leves + imagens dinâmicas, se houver)
if (avatarGrid) {
  const EMOJIS = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😎','🤩','😍','😘','😜','🤪','🤓','🧐','😺','👾'];

  const bindSelection = () => {
    const all = avatarGrid.querySelectorAll('img, .avatar-emoji');
    all.forEach(el => {
      el.onclick = () => {
        all.forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        selectedAvatar = el.getAttribute('data-avatar');
      };
    });
  };

  // Primeiro adiciona emojis (leves)
  avatarGrid.innerHTML = '';
  EMOJIS.forEach(e => {
    const div = document.createElement('div');
    div.className = 'avatar-emoji';
    div.textContent = e;
    div.setAttribute('data-avatar', `emoji:${e}`);
    avatarGrid.appendChild(div);
  });
  // Seleção padrão no primeiro item
  const first = avatarGrid.querySelector('img, .avatar-emoji');
  if (first) {
    first.classList.add('selected');
    selectedAvatar = first.getAttribute('data-avatar');
  }
  bindSelection();

  // Depois tenta carregar imagens do servidor
  fetch('/api/avatars')
    .then(r => r.json())
    .then(data => {
      if (data && data.ok && Array.isArray(data.avatars) && data.avatars.length) {
        const list = [...data.avatars].sort((a,b)=>a.localeCompare(b));
        list.forEach(src => {
          const img = document.createElement('img');
          img.src = src + '?v=' + Date.now();
          img.alt = 'avatar';
          img.setAttribute('data-avatar', src);
          img.onerror = () => { img.remove(); };
          avatarGrid.appendChild(img);
        });
        bindSelection();
      }
    })
    .catch(() => {});
}

btnJoin.onclick = () => {
  const pin = pinInput.value.trim();
  const name = nameInput.value.trim() || 'Jogador';
  if (!pin) { alert('Informe o PIN.'); return; }
  // normaliza avatar para caminho absoluto
  let avatar = selectedAvatar || (avatarGrid && avatarGrid.querySelector('img, .avatar-emoji')?.getAttribute('data-avatar')) || 'emoji:😀';
  // normaliza caminho apenas para imagens; para emoji mantém como está
  if (!avatar.startsWith('emoji:') && !avatar.startsWith('/')) {
    avatar = '/' + avatar;
  }
  socket.emit('player:join', { pin, name, avatar }, (resp) => {
    if (!resp.ok) {
      statusEl.textContent = resp.error || 'Erro ao entrar.';
      return;
    }
    // Salva contexto e redireciona para a página de quiz
    sessionStorage.setItem('pin', pin);
    sessionStorage.setItem('key', resp.key);
    location.href = `/quiz?pin=${encodeURIComponent(pin)}&key=${encodeURIComponent(resp.key)}`;
  });
};

socket.on('room:closed', () => {
  alert('Sala encerrada pelo host.');
  location.href = '/join';
});
