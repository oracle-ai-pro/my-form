// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
const defaultQuestions = [
    { type: "radio", title: "Какая ОС основана на ядре Linux?", options: ["Windows", "Android", "iOS"], correct: [1] }
];

let questions = JSON.parse(localStorage.getItem('quiz_questions')) || defaultQuestions;
let currentIndex = 0;
let currentTimerInterval = null;

// ==========================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Темы и Экраны)
// ==========================================
function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
    }
}

function toggleToolsMenu() {
    document.getElementById('tools-menu').classList.toggle('hidden');
}

function switchScreen(screenName) {
    document.querySelectorAll('.quiz-container, .admin-box').forEach(el => el.classList.add('hidden'));
    
    if (screenName === 'quiz') {
        document.getElementById('quiz-screen').classList.remove('hidden');
        renderQuestion();
    } else if (screenName === 'login') {
        document.getElementById('login-screen').classList.remove('hidden');
    } else if (screenName === 'admin') {
        document.getElementById('admin-screen').classList.remove('hidden');
        renderAdminQuestions();
    }
}

// ==========================================
// 3. ЛОГИКА АДМИНКИ
// ==========================================
function changeAdminCreds() {
    const user = prompt("Введите НОВЫЙ логин:");
    const pass = prompt("Введите НОВЫЙ пароль:");
    if (user && pass) {
        localStorage.setItem('admin_user', user);
        localStorage.setItem('admin_pass', pass);
        alert("Данные сохранены!");
    }
}

function tryLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const savedUser = localStorage.getItem('admin_user') || 'admin';
    const savedPass = localStorage.getItem('admin_pass') || '1234';

    if (user === savedUser && pass === savedPass) {
        switchScreen('admin');
    } else {
        alert("Неверный логин или пароль!");
    }
}

function saveAndRefresh() {
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    renderAdminQuestions();
}

function moveQuestion(index, direction) {
    const newIdx = index + direction;
    if (newIdx >= 0 && newIdx < questions.length) {
        [questions[index], questions[newIdx]] = [questions[newIdx], questions[index]];
        saveAndRefresh();
    }
}

function editQuestion(index) {
    const q = questions[index];
    document.getElementById('new-title').value = q.title;
    document.getElementById('new-type').value = q.type;
    alert("Вопрос загружен в поля ввода.");
}

function previewQuestion(index) {
    currentIndex = index;
    switchScreen('quiz');
}

function deleteQuestion(index) {
    questions.splice(index, 1);
    saveAndRefresh();
}

function renderAdminQuestions() {
    const list = document.getElementById('admin-questions-list');
    list.innerHTML = '';
    questions.forEach((q, i) => {
        list.innerHTML += `
            <div class="question-list-item">
                <span>${i + 1}. ${q.title}</span>
                <div>
                    <button onclick="moveQuestion(${i}, -1)">⬆️</button>
                    <button onclick="moveQuestion(${i}, 1)">⬇️</button>
                    <button onclick="editQuestion(${i})">✏️</button>
                    <button onclick="previewQuestion(${i})">👁️</button>
                    <button onclick="deleteQuestion(${i})" style="color:red">🗑️</button>
                </div>
            </div>`;
    });
}

// ==========================================
// 4. ДВИЖОК ТЕСТА
// ==========================================
function renderQuestion() {
    if (questions.length === 0) return;
    const q = questions[currentIndex];
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;
    // Отрисовка тела вопроса
    document.getElementById('question-body').innerHTML = `<div class="q-title">${q.title}</div>`;
}

function nextStep() {
    currentIndex++;
    if (currentIndex < questions.length) renderQuestion();
    else alert("Тест завершен!");
}

// ==========================================
// 5. ИНИЦИАЛИЗАЦИЯ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    switchScreen('quiz');
});
