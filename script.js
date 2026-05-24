// --- 1. Инициализация и данные ---
let questions = JSON.parse(localStorage.getItem('quiz_questions')) || [];
const ADMIN_PASS = "1234"; // Пароль от админки

// --- 2. Навигация между экранами ---
function switchScreen(id) {
    document.querySelectorAll('.quiz-container').forEach(el => el.classList.add('hidden'));
    document.getElementById(id + '-screen').classList.remove('hidden');
}

// --- 3. Безопасность и Вход ---
function tryLogin() {
    const pass = document.getElementById('login-pass').value;
    if (pass === ADMIN_PASS) {
        switchScreen('admin');
        renderAdminList();
    } else {
        alert("Неверный пароль!");
    }
}

function logout() {
    switchScreen('quiz');
}

// --- 4. Админка ---
function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    document.getElementById('admin-choices-fields').classList.toggle('hidden', type === 'text');
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
}

function addQuestion() {
    const q = {
        title: document.getElementById('new-title').value,
        type: document.getElementById('new-type').value,
        options: document.getElementById('new-options').value.split(','),
        correct: document.getElementById('new-correct-choices').value.split(','),
        correctText: document.getElementById('new-correct-text').value
    };
    questions.push(q);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    renderAdminList();
    alert("Вопрос сохранен!");
}

function renderAdminList() {
    const list = document.getElementById('admin-questions-list');
    list.innerHTML = questions.map((q, i) => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #444;">
            ${q.title}
            <button onclick="deleteQuestion(${i})" style="width:auto; background:red;">✕</button>
        </div>
    `).join('').concat(`<button onclick="logout()" style="background:#555;">Выйти из админки</button>`);
}

function deleteQuestion(i) {
    questions.splice(i, 1);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    renderAdminList();
}

// --- 5. Отрисовка теста ---
function renderQuiz() {
    const container = document.getElementById('question-body');
    if (questions.length === 0) {
        container.innerHTML = "<p>Вопросов пока нет. Зайдите в админку.</p>";
        return;
    }
    // Пример отрисовки первого вопроса
    container.innerHTML = `<h3>${questions[0].title}</h3>`;
}

// --- 6. Запуск ---
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    renderQuiz();
});

function setTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
    localStorage.setItem('theme', theme);
}

function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }
