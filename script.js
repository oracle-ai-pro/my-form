// --- 1. Инициализация ---
let questions = JSON.parse(localStorage.getItem('quiz_questions')) || [];
let userName = "";
let currentScore = 0;
let editingIndex = -1;
const ADMIN_PASS = "1234"; 

// --- 2. Переключение экранов ---
function switchScreen(id) {
    document.querySelectorAll('.quiz-container').forEach(el => el.classList.add('hidden'));
    document.getElementById(id + '-screen').classList.remove('hidden');
}

// --- 3. Админка ---
function tryLogin() {
    if (document.getElementById('login-pass').value === ADMIN_PASS) switchScreen('admin');
    else alert("Неверный пароль!");
}

function renderAdminList() {
    const list = document.getElementById('admin-questions-list');
    list.innerHTML = questions.map((q, i) => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #444;">
            <span>${i + 1}. ${q.title} (${q.points || 0} б)</span>
            <div>
                <button onclick="alert('Вопрос: ${q.title}')">👁️</button>
                <button onclick="editQuestion(${i})">✎</button>
                <button onclick="deleteQuestion(${i})" style="background:red;">✕</button>
            </div>
        </div>
    `).join('');
}

function addQuestion() {
    const q = {
        title: document.getElementById('new-title').value,
        points: document.getElementById('new-points').value,
        type: document.getElementById('new-type').value
    };
    if (editingIndex === -1) questions.push(q);
    else { questions[editingIndex] = q; editingIndex = -1; }
    
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    renderAdminList();
    alert("Сохранено!");
}

function editQuestion(i) {
    editingIndex = i;
    document.getElementById('new-title').value = questions[i].title;
    document.getElementById('new-points').value = questions[i].points;
    switchScreen('admin');
}

function deleteQuestion(i) {
    questions.splice(i, 1);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    renderAdminList();
}

// --- 4. Тест и Результаты ---
function startQuiz() {
    userName = document.getElementById('user-name').value;
    if (!userName) return alert("Введите Имя и Фамилию!");
    switchScreen('quiz');
}

function copyResult() {
    navigator.clipboard.writeText(`Имя: ${userName}, Баллы: ${currentScore}`);
    alert("Результат скопирован!");
}

function downloadResult() {
    const text = `Ученик: ${userName}\nБаллы: ${currentScore}`;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = 'result.txt';
    a.click();
}

// --- 5. Утилиты ---
function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }

function setTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
    localStorage.setItem('theme', theme);
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    renderAdminList();
});
