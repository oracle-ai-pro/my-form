// Глобальные переменные
const defaultQuestions = [{ type: "radio", title: "Пример вопроса?", options: ["Опция 1", "Опция 2"], correct: [0] }];
let questions = JSON.parse(localStorage.getItem('quiz_questions')) || defaultQuestions;
let currentIndex = 0;

// 1. Отрисовка интерфейса (исправление ошибки с пустыми вопросами)
function renderQuestion() {
    if (questions.length === 0) return;
    const q = questions[currentIndex];
    const body = document.getElementById('question-body');
    
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;

    let html = `<div class="q-title">${q.title.replace('[input]', '<input type="text" class="inline-input">')}</div>`;

    if (q.type === 'radio' || q.type === 'checkbox') {
        q.options.forEach((opt, i) => {
            html += `<label class="option"><input type="${q.type}" name="q-option" value="${i}"> ${opt}</label>`;
        });
    } else if (q.type === 'select') {
        html += `<select class="admin-input">${q.options.map(opt => `<option>${opt}</option>`).join('')}</select>`;
    }
    
    body.innerHTML = html;
}

// 2. Управление экранами и меню
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

function toggleToolsMenu() {
    document.getElementById('tools-menu').classList.toggle('hidden');
}

function setTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
    localStorage.setItem('theme', theme);
    document.getElementById('tools-menu').classList.add('hidden');
}

// 3. Админка
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

function moveQuestion(index, direction) {
    const newIdx = index + direction;
    if (newIdx >= 0 && newIdx < questions.length) {
        [questions[index], questions[newIdx]] = [questions[newIdx], questions[index]];
        localStorage.setItem('quiz_questions', JSON.stringify(questions));
        renderAdminQuestions();
    }
}

function deleteQuestion(index) {
    questions.splice(index, 1);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    renderAdminQuestions();
}

function tryLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    if (user === (localStorage.getItem('admin_user') || 'admin') && 
        pass === (localStorage.getItem('admin_pass') || '1234')) {
        switchScreen('admin');
    } else {
        alert("Неверно!");
    }
}

function nextStep() {
    if (currentIndex < questions.length - 1) {
        currentIndex++;
        renderQuestion();
    } else {
        alert("Тест завершен!");
    }
}

// 4. Инициализация
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    renderQuestion();
});
