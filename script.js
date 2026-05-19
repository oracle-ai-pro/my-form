// Переменные состояния приложения
const defaultQuestions = [
    { type: "checkbox", title: "Какие технологии используются для фронтенда?", answers: ["HTML", "CSS", "C++", "JavaScript"], correct: [0, 1, 3], timer: 0, editable: true, required: true, explanation: null },
    { type: "select", title: "Главный скриптовый язык сценариев в браузере:", answers: ["Python", "PHP", "JavaScript"], correct: [2], timer: 12, editable: false, required: true, explanation: { title: "Инфо", desc: "JS — стандарт веба.", timer: 3 } }
];

let myQuestions = JSON.parse(localStorage.getItem('quiz_questions_v5')) || defaultQuestions;
let currentQuestionIndex = 0, score = 0, userAnswers = [], timerInterval = null, timeLeft = 0, expInterval = null;

// Инициализация URL-параметров при старте страницы
const urlParams = new URLSearchParams(window.location.search);
const sharedQuiz = urlParams.get('quiz');
if (sharedQuiz) {
    try {
        myQuestions = JSON.parse(decodeURIComponent(escape(atob(sharedQuiz))));
    } catch (e) { console.error("Ошибка импорта ссылки:", e); }
}

// Переключение тем оформления
function setTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('quiz_theme', theme);
    document.getElementById('tools-menu').classList.add('hidden');
}
const savedTheme = localStorage.getItem('quiz_theme');
if (savedTheme === 'dark') document.body.classList.add('dark-theme');

function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }
window.addEventListener('click', e => {
    if (!e.target.matches('.tools-btn')) document.getElementById('tools-menu')?.classList.add('hidden');
});

// Движок тестирования
function initQuiz() {
    currentQuestionIndex = 0; score = 0; userAnswers = [];
    clearInterval(timerInterval); clearInterval(expInterval);
    document.getElementById('explanation-box').classList.add('hidden');
    if (!myQuestions.length) {
        document.getElementById('question-body').innerHTML = '<p>Вопросов нет.</p>';
        return;
    }
    document.getElementById('total-number').innerText = myQuestions.length;
    document.getElementById('quiz-box').classList.remove('hidden');
    document.getElementById('result-box').classList.add('hidden');
    showQuestion();
}

function showQuestion() {
    clearInterval(timerInterval);
    const q = myQuestions[currentQuestionIndex];
    const body = document.getElementById('question-body');
    
    document.getElementById('current-number').innerText = currentQuestionIndex + 1;
    document.getElementById('progress').style.width = (currentQuestionIndex / myQuestions.length) * 100 + '%';
    document.getElementById('next-btn').innerText = (currentQuestionIndex === myQuestions.length - 1) ? "Узнать результат" : "Далее";

    const tDisplay = document.getElementById('timer-display');
    if (q.timer > 0) {
        tDisplay.classList.remove('hidden');
        timeLeft = q.timer;
        document.getElementById('timer-seconds').innerText = timeLeft;
        timerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('timer-seconds').innerText = timeLeft;
            if (timeLeft <= 0) { clearInterval(timerInterval); forceTimeoutAnswer(); }
        }, 1000);
    } else { tDisplay.classList.add('hidden'); }

    const star = q.required ? '<span class="required-star">*</span>' : '';
    let html = `<div class="q-title">${q.title} ${star}</div>`;
    
    if (q.type === "radio" || q.type === "checkbox") {
        q.answers.forEach((ans, idx) => {
            html += `<label class="option"><input type="${q.type}" name="user-choice" value="${idx}" onchange="handleLiveLock(this)">${ans}</label>`;
        });
        body.innerHTML = html;
    } else if (q.type === "select") {
        html += `<select id="user-select" onchange="handleLiveLock(this)"><option value="" disabled selected>-- Выберите ответ --</option>`;
        q.answers.forEach((ans, idx) => html += `<option value="${idx}">${ans}</option>`);
        body.innerHTML = html + `</select>`;
    } else if (q.type === "text") {
        body.innerHTML = q.title.includes("[input]") 
            ? `<div class="q-title">${q.title.replace("[input]", `<input type="text" id="user-text" class="inline-input" autocomplete="off" onblur="handleLiveLock(this)">`)} ${star}</div>`
            : html + `<input type="text" id="user-text" class="text-input" placeholder="Введите ответ..." autocomplete="off" onblur="handleLiveLock(this)">`;
    }
}

function handleLiveLock(el) {
    const q = myQuestions[currentQuestionIndex];
    if (q.editable === false) {
        if (el.id === "user-text" && !el.value.trim()) return;
        document.getElementById('question-body').querySelectorAll('input, select').forEach(i => i.disabled = true);
        document.getElementById('question-body').querySelectorAll('.option').forEach(l => l.style.opacity = '0.5');
    }
}

function nextStep() {
    const q = myQuestions[currentQuestionIndex];
    let currentAnswer = null, isCorrect = false, isEmpty = false;

    if (q.type === "radio" || q.type === "checkbox") {
        const checked = Array.from(document.querySelectorAll('input[name="user-choice"]:checked')).map(c => parseInt(c.value));
        if (!checked.length) isEmpty = true;
        else {
            currentAnswer = q.type === "radio" ? checked[0] : checked;
            isCorrect = q.type === "radio" ? q.correct.includes(currentAnswer) : (q.correct.length === checked.length && q.correct.every(v => checked.includes(v)));
        }
    } else if (q.type === "select") {
        const el = document.getElementById('user-select');
        if (!el || el.value === "") isEmpty = true;
        else { currentAnswer = parseInt(el.value); isCorrect = q.correct.includes(currentAnswer); }
    } else if (q.type === "text") {
        const val = document.getElementById('user-text')?.value.trim() || "";
        if (!val) isEmpty = true;
        else { currentAnswer = val; isCorrect = q.correct.some(ans => ans.toLowerCase() === val.toLowerCase()); }
    }

    if (q.required && isEmpty) return alert("Этот вопрос обязателен для заполнения!");
    if (isEmpty) { currentAnswer = "[Пропущено]"; isCorrect = false; }

    if (isCorrect) score++;
    userAnswers.push({ value: currentAnswer, isCorrect: isCorrect });

    // Проверка логики "Объяснения"
    if (q.explanation && q.explanation.title) {
        clearInterval(timerInterval);
        const expBox = document.getElementById('explanation-box');
        const expBtn = document.getElementById('exp-close-btn');
        document.getElementById('exp-title-text').innerText = q.explanation.title;
        document.getElementById('exp-desc-text').innerText = q.explanation.desc;
        expBox.classList.remove('hidden');

        if (q.explanation.timer > 0) {
            expBtn.disabled = true;
            let secLeft = q.explanation.timer;
            expBtn.innerText = `Продолжить (${secLeft}с)`;
            expInterval = setInterval(() => {
                secLeft--;
                expBtn.innerText = `Продолжить (${secLeft}с)`;
                if (secLeft <= 0) {
                    clearInterval(expInterval);
                    expBtn.disabled = false;
                    expBtn.innerText = "Продолжить";
                }
            }, 1000);
        } else {
            expBtn.disabled = false;
            expBtn.innerText = "Продолжить";
        }
    } else { advanceQuiz(); }
}

function closeExplanation() {
    clearInterval(expInterval);
    document.getElementById('explanation-box').classList.add('hidden');
    advanceQuiz();
}

function advanceQuiz() {
    currentQuestionIndex++;
    if (currentQuestionIndex < myQuestions.length) showQuestion(); else showResults();
}

function forceTimeoutAnswer() {
    userAnswers.push({ value: "[Время истекло]", isCorrect: false });
    advanceQuiz();
}

function showResults() {
    clearInterval(timerInterval);
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');
    document.getElementById('final-score').innerText = `${score} / ${myQuestions.length}`;
    
    const pct = (score / myQuestions.length) * 100;
    document.getElementById('feedback-text').innerText = pct === 100 ? "Идеально! Вы гений! 🏆" : pct >= 70 ? "Отлично! 👍" : "Можно лучше! 💪";

    const reviewBox = document.getElementById('review-box');
    reviewBox.innerHTML = '<h3>Разбор ответов:</h3>';

    myQuestions.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        if (!userAns) return;
        const itemDiv = document.createElement('div');
        itemDiv.className = `review-item ${userAns.isCorrect ? 'correct-item' : 'incorrect-item'}`;
        
        let html = `<div class="review-q">${idx + 1}. ${q.title.replace("[input]", "_______")}</div>`;
        let uDisp = userAns.value, cDisp = "";

        if (q.type === "radio" || q.type === "select") {
            uDisp = q.answers[userAns.value] || userAns.value;
            cDisp = q.answers[q.correct[0]] || q.answers[q.correct];
        } else if (q.type === "checkbox") {
            uDisp = Array.isArray(userAns.value) ? userAns.value.map(v => q.answers[v]).join(', ') : userAns.value;
            cDisp = q.correct.map(v => q.answers[v]).join(', ');
        } else { cDisp = q.correct.join(' / '); }

        html += `<div class="review-ans">Ваш ответ: <span class="${userAns.isCorrect ? 'text-success' : 'text-danger'}">${uDisp}</span></div>`;
        if (!userAns.isCorrect) html += `<div class="review-ans">Правильно: <span class="text-success">${cDisp}</span></div>`;
        
        itemDiv.innerHTML = html;
        reviewBox.appendChild(itemDiv);
    });
}

function restartQuiz() { initQuiz(); }

function generateShareLink() {
    try {
        if (!myQuestions.length) return alert("Добавьте вопросы в админке!");
        const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(myQuestions))));
        const shareUrl = `${window.location.origin}${window.location.pathname}?quiz=${base64}`;
        navigator.clipboard.writeText(shareUrl).then(() => alert("Ссылка скопирована в буфер обмена! 😎"))
            .catch(() => prompt("Скопируйте ссылку вручную:", shareUrl));
    } catch (e) { alert("Ошибка генерации ссылки."); }
}

// Функции панели Администратора
function switchScreen(screen) {
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('footer-link').classList.add('hidden');
    
    if (screen === 'quiz') { document.getElementById('quiz-screen').classList.remove('hidden'); document.getElementById('footer-link').classList.remove('hidden'); initQuiz(); } 
    else if (screen === 'login') document.getElementById('login-screen').classList.remove('hidden');
    else if (screen === 'admin') { document.getElementById('admin-screen').classList.remove('hidden'); renderAdminQuestions(); }
}

function tryLogin() {
    if (document.getElementById('login-user').value === 'admin' && document.getElementById('login-pass').value === '1234') switchScreen('admin');
    else alert('Неверные данные!');
}

function logout() { switchScreen('quiz'); }

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    document.getElementById('admin-choices-fields').classList.toggle('hidden', type === 'text');
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
}

function addQuestion() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();
    if (!title) return alert("Введите вопрос!");

    const editable = document.getElementById('new-editable').checked;
    const required = document.getElementById('new-required').checked;
    const timer = document.getElementById('toggle-timer-input').checked ? (parseInt(document.getElementById('new-timer').value) || 20) : 0;
    
    const hasExp = document.getElementById('toggle-exp-input').checked;
    const explanation = hasExp ? {
        title: document.getElementById('new-exp-title').value.trim(),
        desc: document.getElementById('new-exp-desc').value.trim(),
        timer: parseInt(document.getElementById('new-exp-timer').value) || 0
    } : null;
    
    let newQ = { type, title, timer, editable, required, explanation };

    if (type !== 'text') {
        const optStr = document.getElementById('new-options').value;
        const correctStr = document.getElementById('new-correct-choices').value;
        if (!optStr || !correctStr) return alert("Заполните варианты и индексы ответа!");
        newQ.answers = optStr.split(',').map(i => i.trim());
        newQ.correct = correctStr.split(',').map(i => parseInt(i.trim()));
    } else {
        const textStr = document.getElementById('new-correct-text').value;
        if (!textStr) return alert("Введите текстовый ответ!");
        newQ.correct = textStr.split(',').map(i => i.trim());
    }

    myQuestions.push(newQ);
    localStorage.setItem('quiz_questions_v5', JSON.stringify(myQuestions));
    renderAdminQuestions();
    ['new-title', 'new-options', 'new-correct-choices', 'new-correct-text', 'new-exp-title', 'new-exp-desc'].forEach(id => document.getElementById(id).value = '');
    alert("Вопрос сохранен!");
}

function deleteQuestion(index) {
    if (confirm("Удалить?")) {
        myQuestions.splice(index, 1);
        localStorage.setItem('quiz_questions_v5', JSON.stringify(myQuestions));
        renderAdminQuestions();
    }
}

function renderAdminQuestions() {
    const container = document.getElementById('admin-questions-list');
    container.innerHTML = '';
    myQuestions.forEach((q, idx) => {
        const item = document.createElement('div');
        item.className = 'question-list-item';
        item.innerHTML = `<span><strong>${idx + 1}.</strong> ${q.title} <em>(${q.type}${q.explanation ? ' +Объясн.' : ''})</em></span><button class="btn-danger" onclick="deleteQuestion(${idx})">Удалить</button>`;
        container.appendChild(item);
    });
}

// Старт
initQuiz();
