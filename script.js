const questions = [
    {
        question: "Pergunta 1?",
        answers: ["Resposta 1", "Resposta 2", "Resposta 3", "Resposta 4"],
        correct: 0
    }
    // Adicione mais perguntas aqui
];

let currentPlayer = {
    name: '',
    avatar: '',
    score: 0
};

let timer;
let timeLeft;
let currentQuestion = 0;
const POINTS_PER_QUESTION = 1000;
const TIME_PER_QUESTION = 30;

// Sons
const countdownSound = document.getElementById('countdown-sound');
const correctSound = document.getElementById('correct-sound');
const wrongSound = document.getElementById('wrong-sound');

// Seleção de Avatar
document.querySelectorAll('.avatar').forEach(avatar => {
    avatar.addEventListener('click', () => {
        document.querySelectorAll('.avatar').forEach(a => a.classList.remove('selected'));
        avatar.classList.add('selected');
        currentPlayer.avatar = avatar.dataset.avatar;
    });
});

// Iniciar Jogo
document.getElementById('start-btn').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value;
    if (!playerName || !currentPlayer.avatar) {
        alert('Por favor, escolha um avatar e digite seu nome!');
        return;
    }
    currentPlayer.name = playerName;
    startGame();
});

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.remove('hidden');
    showQuestion(0);
}

function showQuestion(index) {
    const question = questions[index];
    document.getElementById('question').textContent = question.question;
    
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach((btn, i) => {
        btn.textContent = question.answers[i];
        btn.onclick = () => checkAnswer(i, index);
    });

    // Atualiza a questão atual para o timer conseguir acessar
    currentQuestion = index;
    startTimer();
}

function startTimer() {
    timeLeft = TIME_PER_QUESTION;
    updateTimerDisplay();
    
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 5) {
            countdownSound.play();
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            checkAnswer(-1, currentQuestion);
        }
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById('timer').textContent = timeLeft;
}

function checkAnswer(selectedAnswer, questionIndex) {
    clearInterval(timer);
    const correct = questions[questionIndex].correct;
    
    if (selectedAnswer === correct) {
        correctSound.play();
        const timeBonus = timeLeft / TIME_PER_QUESTION;
        currentPlayer.score += Math.floor(POINTS_PER_QUESTION * timeBonus);
    } else {
        wrongSound.play();
    }
    
    showResult(questionIndex);
}

function showResult(questionIndex) {
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    
    // Mostrar pontuação da rodada
    document.getElementById('round-score').textContent = 
        `Pontuação: ${currentPlayer.score}`;
    
    setTimeout(() => {
        if (questionIndex < questions.length - 1) {
            document.getElementById('result-screen').classList.add('hidden');
            document.getElementById('quiz-screen').classList.remove('hidden');
            showQuestion(questionIndex + 1);
        } else {
            showFinalResults();
        }
    }, 3000);
}

function showFinalResults() {
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('final-screen').classList.remove('hidden');
    
    // Aqui você pode adicionar a lógica para mostrar o pódio final
}

document.getElementById('restart-btn').addEventListener('click', () => {
    location.reload();
});

