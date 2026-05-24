// ==========================================
// 1. БАЗА ДАННЫХ (ДЕФОЛТНЫЕ ВОПРОСЫ ДЛЯ СТАРТА)
// ==========================================
const defaultQuestions = [
    { type: "radio", title: "Какая операционная系统 основана на ядре Linux?", required: true, editable: true, timer: 20, useTimer: true, options: ["Windows", "Android", "iOS", "macOS"], correct: [1], exp: { title: "Интересный факт", desc: "Android использует ядро Linux для управления процессами.", hold: 2 } },
    { type: "text", title: "Как называется утилита ADB для прошивки разделов на низком уровне?", required: true, editable: true, useTimer: false, correctText: ["fastboot", "фастбут"] },
    { type: "checkbox", title: "Какие технологии являются базовыми для фронтенда?", required: true, editable: true, useTimer: false, options: ["HTML", "C++", "JavaScript", "CSS"], correct: [0, 2, 3] },
    { type: "select", title: "Выберите основной тег-контейнер для создания блочных элементов в HTML:", required: true, editable: true, useTimer: false, options: ["div", "span", "p", "a"], correct: [0] }
];

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
let questions = [];
let currentIndex = 0;
let userAnswers = [];
let currentTimerInterval = null;
let timeLeft = 0;
let isExplanationState = false;
let currentTheme = 'light';
let isDefaultSet = false; // Флаг, что используются дефолтные вопросы

// Загрузка вопросов из LocalStorage
function loadQuestions() {
    let saved = localStorage.getItem('quiz_questions');
    if (!saved) {
        localStorage.setItem('quiz_questions', JSON.stringify(defaultQuestions));
        isDefaultSet = true;
        return defaultQuestions;
    }
    try {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
            // Проверяем, совпадает ли с дефолтным массивом
            isDefaultSet = (JSON.stringify(parsed) === JSON.stringify(defaultQuestions));
            return parsed;
        }
    } catch(e) { console.error("Ошибка парсинга localStorage", e); }
    isDefaultSet = true;
    return defaultQuestions;
}

// Получение данных авторизации из LocalStorage
function getAdminAuth() {
    const savedAuth = localStorage.getItem('quiz_admin_auth');
    if (savedAuth) return JSON.parse(savedAuth);
    return { user: 'admin', pass: '1234' };
}

// ==========================================
// 3. ДВИЖОК ЭКРАНОВ И ИНТЕРФЕЙСА
// ==========================================
function switchScreen(screenName) {
    if (screenName !== 'quiz') clearInterval(currentTimerInterval);

    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');

    if (screenName === 'quiz') {
        document.getElementById('quiz-screen').classList.remove('hidden');
        if (currentIndex < questions.length) {
            document.getElementById('quiz-box').classList.remove('hidden');
            document.getElementById('result-box').classList.add('hidden');
            renderQuestion();
        } else {
            showResults();
        }
    } else if (screenName === 'login') {
        document.getElementById('login-screen').classList.remove('hidden');
        const auth = getAdminAuth();
        document.getElementById('login-user').placeholder = auth.user;
        document.getElementById('login-pass').placeholder = "••••";
    } else if (screenName === 'admin') {
        document.getElementById('admin-screen').classList.remove('hidden');
        renderAdminQuestions();
    }
    applyThemeStyles(currentTheme);
}

function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

function setTheme(theme) {
    currentTheme = theme;
    applyThemeStyles(theme);
    toggleToolsMenu();
}

function applyThemeStyles(theme) {
    const containers = document.querySelectorAll('.quiz-container, .quiz-box, .result-card, .admin-box, .admin-item');
    if (theme === 'dark') {
        document.body.style.backgroundColor = '#121214';
        document.body.style.color = '#ffffff';
        containers.forEach(el => {
            el.style.backgroundColor = '#1e1e22';
            el.style.color = '#ffffff';
            el.style.borderColor = '#333338';
        });
    } else {
        document.body.style.backgroundColor = '#f4f4f9';
        document.body.style.color = '#333333';
        containers.forEach(el => {
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#333333';
            el.style.borderColor = '#eeeeee';
        });
    }
}

// Сжатие ссылки
async function generateShareLink() {
    try {
        const currentQuestions = localStorage.getItem('quiz_questions') || JSON.stringify(defaultQuestions);
        const stream = new Blob([currentQuestions]).stream().pipeThrough(new CompressionStream('deflate'));
        const response = new Response(stream);
        const buffer = await response.arrayBuffer();
        const binary = String.fromCharCode(...new Uint8Array(buffer));
        const encodedData = btoa(binary);
        
        const cleanUrl = window.location.href.split('?')[0];
        const shareUrl = cleanUrl + '?zip=' + encodedData;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert("Ссылка на тест сжата и скопирована! 🚀");
            }).catch(() => fallbackCopy(shareUrl));
        } else {
            fallbackCopy(shareUrl);
        }
    } catch (e) {
        alert("Ошибка при создании ссылки.");
    }
    toggleToolsMenu();
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try {
        if (document.execCommand('copy')) alert("Ссылка скопирована! 🚀");
        else prompt("Скопируй вручную:", text);
    } catch (err) { prompt("Скопируй вручную:", text); }
    document.body.removeChild(textArea);
}

// ==========================================
// 4. АВТОРИЗАЦИЯ И СМЕНА ПАРОЛЯ
// ==========================================
function tryLogin() {
    const user = document.getElementById('login-user').value || document.getElementById('login-user').placeholder;
    const pass = document.getElementById('login-pass').value || "1234";
    const auth = getAdminAuth();

    if (user === auth.user && pass === auth.pass) {
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        switchScreen('admin');
    } else {
        alert("Неверный логин или пароль!");
    }
}

function logout() { switchScreen('quiz'); }

function changeAdminAuth() {
    const auth = getAdminAuth();
    const newUser = prompt("Введите новый логин:", auth.user);
    const newPass = prompt("Введите новый пароль (минимум 4 символа):");
    if (newUser && newPass) {
        localStorage.setItem('quiz_admin_auth', JSON.stringify({ user: newUser, pass: newPass }));
        alert("Данные изменены! Страница будет перезагружена.");
        location.reload();
    }
}

// ==========================================
// 5. ДВИЖОК ТЕСТА (ДЛЯ УЧЕНИКА)
// ==========================================
function renderQuestion() {
    clearInterval(currentTimerInterval);
    isExplanationState = false;
    if (!questions || questions.length === 0) return;

    const q = questions[currentIndex];
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;
    document.getElementById('progress').style.width = `${(currentIndex / questions.length) * 100}%`;

    const nextBtn = document.getElementById('next-btn');
    nextBtn.innerText = "Далее"; nextBtn.disabled = false;

    let html = `<h3>${q.title} ${q.required ? '<span style="color:red">*</span>' : ''}</h3>`;
    
    if (q.type === 'radio') {
        q.options.forEach((opt, idx) => { html += `<label class="option-label" style="display:block; margin:8px 0;"><input type="radio" name="quiz_ans" value="${idx}"> ${opt}</label>`; });
    } else if (q.type === 'checkbox') {
        q.options.forEach((opt, idx) => { html += `<label class="option-label" style="display:block; margin:8px 0;"><input type="checkbox" name="quiz_ans" value="${idx}"> ${opt}</label>`; });
    } else if (q.type === 'select') {
        html += `<select id="quiz_select" class="admin-input" style="width:100%; padding:8px; margin-top:10px;"><option value="">-- Выберите ответ --</option>`;
        q.options.forEach((opt, idx) => { html += `<option value="${idx}">${opt}</option>`; });
        html += `</select>`;
    } else if (q.type === 'text') {
        html += `<input type="text" id="quiz_text" class="admin-input" style="width:100%; padding:8px; margin-top:10px;" placeholder="Введите ваш ответ...">`;
    }

    html += `<div id="explanation-container" class="hidden" style="margin-top:15px; padding:15px; border-radius:6px; background:#fff3cd; color:#333;"></div>`;
    document.getElementById('question-body').innerHTML = html;

    const timerDisplay = document.getElementById('timer-display');
    if (q.useTimer && q.timer > 0) {
        timerDisplay.classList.remove('hidden');
        timeLeft = q.timer;
        document.getElementById('timer-seconds').innerText = timeLeft;
        currentTimerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('timer-seconds').innerText = timeLeft;
            if (timeLeft <= 0) { clearInterval(currentTimerInterval); nextStep(true); }
        }, 1000);
    } else { timerDisplay.classList.add('hidden'); }
}

function nextStep(isTimeout = false) {
    if (questions.length === 0) return;
    const q = questions[currentIndex];

    if (isExplanationState) {
        currentIndex++;
        if (currentIndex < questions.length) renderQuestion(); else showResults();
        return;
    }

    let answers = [];
    let rawValue = "";

    if (!isTimeout) {
        if (q.type === 'radio') {
            let checked = document.querySelector('input[name="quiz_ans"]:checked');
            if (checked) { answers.push(parseInt(checked.value)); rawValue = q.options[checked.value]; }
        } else if (q.type === 'checkbox') {
            let checkedBoxes = document.querySelectorAll('input[name="quiz_ans"]:checked');
            checkedBoxes.forEach(cb => { answers.push(parseInt(cb.value)); });
            rawValue = answers.map(i => q.options[i]).join(', ');
        } else if (q.type === 'select') {
            let sel = document.getElementById('quiz_select').value;
            if (sel !== "") { answers.push(parseInt(sel)); rawValue = q.options[sel]; }
        } else if (q.type === 'text') {
            rawValue = document.getElementById('quiz_text').value.trim();
        }

        if (q.required && answers.length === 0 && rawValue === "") {
            alert("Этот вопрос обязателен!"); return;
        }
    } else { rawValue = "[Время истекло]"; }

    clearInterval(currentTimerInterval);

    let isCorrect = false;
    if (q.type === 'text') {
        if (q.correctText) isCorrect = q.correctText.some(t => t.toLowerCase().trim() === rawValue.toLowerCase().trim());
    } else {
        if(q.correct && q.correct.length === answers.length) isCorrect = q.correct.every(v => answers.includes(v));
    }

    userAnswers.push({
        title: q.title, userAns: rawValue, isCorrect: isCorrect,
        correctInfo: q.type === 'text' ? q.correctText?.join(' / ') : q.correct?.map(i => q.options[i]).join(', ')
    });

    if (q.exp && q.exp.desc && !isTimeout) {
        isExplanationState = true;
        const expBox = document.getElementById('explanation-container');
        expBox.classList.remove('hidden');
        expBox.innerHTML = `<strong>${q.exp.title || 'Объяснение'}:</strong> ${q.exp.desc}`;
        const nextBtn = document.getElementById('next-btn');
        nextBtn.innerText = "Продолжить";
        if (q.exp.hold > 0) {
            nextBtn.disabled = true; let holdTime = q.exp.hold;
            nextBtn.innerText = `Продолжить (${holdTime}s)`;
            let holdInterval = setInterval(() => {
                holdTime--; nextBtn.innerText = `Продолжить (${holdTime}s)`;
                if(holdTime <= 0) { clearInterval(holdInterval); nextBtn.disabled = false; nextBtn.innerText = "Продолжить"; }
            }, 1000);
        }
        return;
    }

    currentIndex++;
    if (currentIndex < questions.length) renderQuestion(); else showResults();
}

// ==========================================
// 6. СБОР ОТЧЕТОВ И ФИКС КРАКОЗЯБР (BOM)
// ==========================================
function showResults() {
    document.getElementById('quiz-box').classList.add('hidden');
    const resultBox = document.getElementById('result-box');
    resultBox.classList.remove('hidden');
    document.getElementById('progress').style.width = `100%`;

    let score = userAnswers.filter(a => a.isCorrect).length;
    document.getElementById('final-score').innerText = `${score} / ${questions.length}`;

    let reviewHtml = "<h3>Разбор ответов:</h3>";
    userAnswers.forEach((ans, idx) => {
        reviewHtml += `
            <div style="border-left:4px solid ${ans.isCorrect ? '#28a745' : '#dc3545'}; padding-left:10px; margin-bottom:10px; text-align:left;">
                <p><strong>${idx + 1}. ${ans.title}</strong></p>
                <p>Ваш ответ: <span style="color:${ans.isCorrect ? 'green' : 'red'}">${ans.userAns || '[Нет ответа]'}</span></p>
            </div>
        `;
    });
    document.getElementById('review-box').innerHTML = reviewHtml;

    let studentName = prompt("Введите ваше Имя и Фамилию для отчета:") || "Аноним";
    let reportData = { student: studentName, score: `${score} / ${questions.length}`, date: new Date().toLocaleString(), answers: userAnswers.map(a => ({q: a.title, ans: a.userAns, correct: a.isCorrect})) };
    let encodedResults = btoa(encodeURIComponent(JSON.stringify(reportData)));

    let oldForm = document.getElementById('teacher-submission-block'); if (oldForm) oldForm.remove();
    const shareResultsDiv = document.createElement('div');
    shareResultsDiv.id = 'teacher-submission-block';
    shareResultsDiv.style = "margin-top:20px; padding:15px; background:rgba(40,167,69,0.1); border-radius:8px; border:1px solid #28a745;";
    shareResultsDiv.innerHTML = `
        <h3>📥 Сдача работы учителю</h3>
        <button id="copy-code-btn" style="background:#28a745; color:white; width:100%; margin-bottom:10px; padding:10px; border-radius:4px; border:none; font-weight:bold;">📋 Копировать код ответов</button>
        <button id="download-txt-btn" style="background:#17a2b8; color:white; width:100%; padding:10px; border-radius:4px; border:none; font-weight:bold;">💾 Скачать файл отчета (.txt)</button>
    `;
    resultBox.appendChild(shareResultsDiv);

    document.getElementById('copy-code-btn').addEventListener('click', () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(encodedResults).then(() => alert('Код скопирован!'));
        } else fallbackCopy(encodedResults);
    });

    document.getElementById('download-txt-btn').addEventListener('click', () => {
        let textContent = `ОТЧЕТ О ПРОХОЖДЕНИИ ТЕСТА\nУченик: ${reportData.student}\nРезультат: ${reportData.score}\nДата: ${reportData.date}\n\n`;
        reportData.answers.forEach((a, i) => { textContent += `${i+1}. ${a.q}\nОтвет: ${a.ans} (${a.correct ? 'ВЕРНО' : 'НЕВЕРНО'})\n\n`; });
        
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, textContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Тест_${reportData.student}.txt`; link.click();
    });
}

function restartQuiz() { currentIndex = 0; userAnswers = []; switchScreen('quiz'); }

// ==========================================
// 7. УПРАВЛЕНИЕ АДМИНКОЙ (ФИЧА РЕДАКТИРОВАНИЯ)
// ==========================================
function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    if (type === 'text') {
        document.getElementById('admin-choices-fields').classList.add('hidden');
        document.getElementById('admin-text-fields').classList.remove('hidden');
    } else {
        document.getElementById('admin-choices-fields').classList.remove('hidden');
        document.getElementById('admin-text-fields').classList.add('hidden');
    }
}

function editQuestion(index) {
    const q = questions[index];
    document.getElementById('edit-index').value = index;
    document.getElementById('new-title').value = q.title;
    document.getElementById('new-type').value = q.type;
    toggleAdminFields();
    
    if (q.type === 'text') {
        document.getElementById('new-correct-text').value = q.correctText?.join(', ') || '';
    } else {
        document.getElementById('new-options').value = q.options?.join(', ') || '';
        document.getElementById('new-correct-choices').value = q.correct?.join(', ') || '';
    }
    document.getElementById('admin-form-title').innerText = "Редактирование вопроса №" + (index + 1);
    document.getElementById('save-btn').innerText = "🔄 Обновить вопрос";
}

function addQuestion() {
    const editIdx = parseInt(document.getElementById('edit-index').value);
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();

    if (!title) { alert("Заполните текст вопроса!"); return; }
    let newQ = { type, title, required: true, editable: true, useTimer: false, timer: 20 };

    if (type === 'text') {
        const txt = document.getElementById('new-correct-text').value;
        if (!txt) { alert("Введите ответ!"); return; }
        newQ.correctText = txt.split(',').map(s => s.trim());
    } else {
        const opts = document.getElementById('new-options').value;
        const choices = document.getElementById('new-correct-choices').value;
        if (!opts || !choices) { alert("Заполните варианты!"); return; }
        newQ.options = opts.split(',').map(s => s.trim());
        newQ.correct = choices.split(',').map(s => parseInt(s.trim()));
    }

    if (editIdx > -1) {
        questions[editIdx] = newQ;
    } else {
        questions.push(newQ);
    }

    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    isDefaultSet = false; // Юзер внес изменения, плашка больше не нужна
    
    // Сброс формы
    document.getElementById('edit-index').value = "-1";
    document.getElementById('new-title').value = '';
    document.getElementById('new-options').value = '';
    document.getElementById('new-correct-choices').value = '';
    document.getElementById('new-correct-text').value = '';
    document.getElementById('admin-form-title').innerText = "Добавить новый вопрос";
    document.getElementById('save-btn').innerText = "➕ Сохранить вопрос";
    
    renderAdminQuestions();
}

function deleteQuestion(index) {
    if (confirm("Удалить этот вопрос?")) {
        questions.splice(index, 1);
        localStorage.setItem('quiz_questions', JSON.stringify(questions));
        if(questions.length === 0) isDefaultSet = true;
        renderAdminQuestions();
    }
}

// Рендеринг списка вопросов с твоим приветственным баннером!
function renderAdminQuestions() {
    const listContainer = document.getElementById('admin-questions-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    // НАША КРУТАЯ ПРИВЕТСТВЕННАЯ ПЛАШКА
    if (isDefaultSet) {
        const welcomeBanner = document.createElement('div');
        welcomeBanner.style = "background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.15); animation: pulse 2s infinite;";
        welcomeBanner.innerText = "🚀 Начни создавать формы, тесты и многое другое уже сейчас!";
        listContainer.appendChild(welcomeBanner);
    }

    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        item.style = "background:rgba(0,0,0,0.02); padding:10px; margin-bottom:8px; border-radius:6px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center; color:inherit;";
        item.innerHTML = `
            <div style="text-align:left;"><strong>${index + 1}.</strong> ${q.title}</div>
            <div style="display:flex; gap:5px;">
                <button onclick="editQuestion(${index})" style="background:#007bff; color:white; width:auto; padding:5px 10px; margin:0;">✏️</button>
                <button onclick="deleteQuestion(${index})" style="background:#dc3545; color:white; width:auto; padding:5px 10px; margin:0;">❌</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
    applyThemeStyles(currentTheme);
}

// ==========================================
// 8. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('data');
    const zippedData = urlParams.get('zip');

    currentIndex = 0; userAnswers = [];

    const leaveBtn = document.getElementById('leave-shared-btn');
    if (leaveBtn) {
        if (sharedData || zippedData) leaveBtn.classList.remove('hidden');
        else leaveBtn.classList.add('hidden');
        leaveBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = window.location.href.split('?')[0]; });
    }

    if (zippedData) {
        try {
            const binary = atob(zippedData);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
            const response = new Response(stream);
            const decodedString = await response.text();
            questions = JSON.parse(decodedString);
            isDefaultSet = false;
        } catch (e) { console.error("Ошибка zip:", e); questions = loadQuestions(); }
    } else if (sharedData) {
        try {
            const decodedString = decodeURIComponent(atob(sharedData));
            questions = JSON.parse(decodedString);
            isDefaultSet = false;
        } catch (e) { questions = loadQuestions(); }
    } else {
        questions = loadQuestions();
    }

    if (!questions || questions.length === 0) {
        questions = defaultQuestions;
        isDefaultSet = true;
    }
    switchScreen('quiz');
});
