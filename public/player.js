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

// Carregar avatares dinamicamente se disponíveis
if (avatarGrid) {
  fetch('/api/avatars')
    .then(r => r.json())
    .then(data => {
      if (data && data.ok && Array.isArray(data.avatars) && data.avatars.length) {
        avatarGrid.innerHTML = '';
        data.avatars.forEach(src => {
          const img = document.createElement('img');
          img.src = src;
          img.alt = 'avatar';
          img.setAttribute('data-avatar', src);
          avatarGrid.appendChild(img);
        });
        // selecionar automaticamente o primeiro avatar
        const first = avatarGrid.querySelector('img');
        if (first) {
          first.classList.add('selected');
          selectedAvatar = first.getAttribute('data-avatar');
        }
      }
      // ligar seleção (para avatares dinâmicos ou estáticos)
      avatarGrid.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', () => {
          avatarGrid.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
          img.classList.add('selected');
          selectedAvatar = img.getAttribute('data-avatar');
        });
      });
    })
    .catch(() => {
      // mantém os avatares estáticos caso a API falhe
      avatarGrid.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', () => {
          avatarGrid.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
          img.classList.add('selected');
          selectedAvatar = img.getAttribute('data-avatar');
        });
      });
    });
}

btnJoin.onclick = () => {
  const pin = pinInput.value.trim();
  const name = nameInput.value.trim() || 'Jogador';
  if (!pin) { alert('Informe o PIN.'); return; }
  // normaliza avatar para caminho absoluto
  let avatar = selectedAvatar || (avatarGrid && avatarGrid.querySelector('img')?.getAttribute('data-avatar')) || '/avatars/avatar1.svg';
  if (avatar && !avatar.startsWith('/')) avatar = '/' + avatar;
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
