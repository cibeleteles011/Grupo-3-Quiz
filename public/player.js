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

// Seleção de avatar
if (avatarGrid) {
  avatarGrid.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => {
      avatarGrid.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
      img.classList.add('selected');
      selectedAvatar = img.getAttribute('data-avatar');
    });
  });
}

btnJoin.onclick = () => {
  const pin = pinInput.value.trim();
  const name = nameInput.value.trim() || 'Jogador';
  if (!pin) { alert('Informe o PIN.'); return; }
  socket.emit('player:join', { pin, name, avatar: selectedAvatar }, (resp) => {
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
