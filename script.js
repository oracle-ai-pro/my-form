// --- ИНИЦИАЛИЗАЦИЯ ДАННЫХ ---
let questions = JSON.parse(localStorage.getItem('quiz_questions')) || [
    { title: "Тест LMSH 2.0 запущен!", type: "text", correctText: ["ок"], required: true }
];
let currentIndex = 0;
let userAnswers = [];

// --- НАВИГАЦИЯ ---
function switchScreen(screenId) {
    document.querySelectorAll('.quiz-container').forEach(el => el.classList.add('hidden'));
    const screen = document.getElementById(screenId + '-screen');
    if (screen) screen.classList.remove('hidden');
}

function toggleToolsMenu() {
    document.getElementById('tools-menu').classList.toggle('hidden');
}

// --- ЛОГИКА ТЕСТА (БЕЗОПАСНОСТЬ) ---
function nextStep() {
    if (questions.length === 0) return;
    const q = questions[currentIndex];
    
    // Получаем ответ (логика сбора зависит от типа)
    let rawValue = "";
    if (q.type === 'text') {
        rawValue = document.getElementById('quiz_text')?.value.trim();
    }
    // Здесь должна быть логика проверки:
    // Если !isCorrect — делаем alert("Неверно!"); return;

    currentIndex++;
    if (currentIndex < questions.length) renderQuestion(); 
    else alert("Тест завершен!");
}

// --- АДМИНКА (ВСЕ ПОЛЯ ВЕРНУЛИСЬ) ---
function addQuestion() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value;
    const isRequired = document.getElementById('new-required')?.checked || false;
    const timer = document.getElementById('new-timer')?.value || 0;
    
    let newQ = { type, title, required: isRequired, timer: timer };

    if (type === 'text') {
        newQ.correctText = document.getElementById('new-correct-text').value.split(',').map(s => s.trim());
    } else {
        newQ.options = document.getElementById('new-options').value.split(',').map(s => s.trim());
        newQ.correct = document.getElementById('new-correct-choices').value.split(',').map(n => parseInt(n.trim()));
    }

    questions.push(newQ);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    alert("Вопрос сохранен!");
    renderAdminList();
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    document.getElementById('admin-choices-fields').classList.toggle('hidden', type === 'text');
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
}

function renderAdminList() {
    const list = document.getElementById('admin-questions-list');
    list.innerHTML = questions.map((q, i) => `
        <div class="admin-item" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border-color);">
            <span>${i + 1}. ${q.title}</span>
            <div>
                <button onclick="editQuestion(${i})" style="width:auto; margin-right:5px; background:#ffc107;">✎</button>
                <button onclick="deleteQuestion(${i})" style="width:auto; background:#dc3545;">✕</button>
            </div>
        </div>
    `).join('');
}

// Глобальная переменная для индекса редактирования
let editingIndex = -1;

function editQuestion(index) {
    editingIndex = index;
    const q = questions[index];
    document.getElementById('new-title').value = q.title;
    document.getElementById('new-type').value = q.type;
    toggleAdminFields();
    // Дополнительно можно заполнить поле options и т.д.
    alert("Режим редактирования вопроса №" + (index + 1));
}

// --- УТИЛИТЫ ---
function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
    }
}

// При загрузке страницы применяем сохраненную тему
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');
});

document.addEventListener('DOMContentLoaded', () => {
    if (questions.length > 0) {
        // renderQuestion(); // Раскомментируй, когда будет готова функция отрисовки
        renderAdminList();
    }
});
