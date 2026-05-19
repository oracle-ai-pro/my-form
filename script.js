// 1. НАЧАЛЬНАЯ БАЗА ДАННЫХ (Загрузится 20 демо-вопросов, если localStorage пустой)
const defaultQuestions = [
    { type: "radio", title: "Какая операционная система основана на ядре Linux?", required: true, editable: true, timer: 20, useTimer: true, options: ["Windows", "Android", "iOS", "macOS"], correct: [1], exp: { title: "Интересный факт", desc: "Android использует ядро Linux для управления железом устройства.", hold: 2 } },
    { type: "text", title: "Как называется инструмент ADB для прошивки разделов? (fast...)", required: true, editable: true, useTimer: false, correctText: ["fastboot", "фастбут"] },
    { type: "checkbox", title: "Какие языки используются в веб-разработке?", required: true, editable: true, useTimer: false, options: ["HTML", "C++", "JavaScript", "Python"], correct: [0, 2] },
    { type: "select", title: "Выберите основной тег контейнера в HTML:", required: true, editable: true, useTimer: false, options: ["div", "span", "p", "a"], correct: [0] },
    { type: "radio", title: "Где хранятся данные localStorage?", required: true, editable: true, useTimer: false, options: ["На сервере", "В браузере пользователя", "В оперативной памяти"], correct: [1] }
];

// Генерируем еще 15 вопросов для круглого числа 20, чтобы база была заполнена
for(let i = 6; i <= 20; i++) {
    defaultQuestions.push({
        type: "radio",
        title: `Дополнительный вопрос №${i} от системы?`,
        required: true,
        editable: true,
        useTimer: false,
        options: ["Вариант А", "Вариант Б", "Вариант В"],
        correct: [0]
    });
}

// 2. ИНИЦИАЛИЗАЦИЯ И ПЕРЕМЕННЫЕ СОСТОЯНИЯ
let questions = [];
let currentIndex = 0;
let userAnswers = [];
let currentTimerInterval = null;
let timeLeft = 0;
let isExplanationState = false; // Состояние, когда показываем объяснение

// Загрузка вопросов
function loadQuestions() {
    let saved = localStorage.getItem('quiz_questions');
    if (!saved) {
        localStorage.setItem('quiz_questions', JSON.stringify(defaultQuestions));
        return defaultQuestions;
    }
    return JSON.parse(saved);
}

questions = loadQuestions();

// 3. ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
function switchScreen(screenName) {
    // Сбрасываем таймеры при уходе с экрана теста
    if (screenName !== 'quiz') clearInterval(currentTimerInterval);

    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('footer-link').classList.add('hidden');

    if (screenName === 'quiz') {
        document.getElementById('quiz-screen').classList.remove('hidden');
        document.getElementById('footer-link').classList.remove('hidden');
        // Показываем нужный бокс внутри квиза
        if (currentIndex < questions.length) {
            document.getElementById('quiz-box').classList.remove('hidden');
            document.getElementById('result-box').classList.add('hidden');
            renderQuestion();
        } else {
            showResults();
        }
    } else if (screenName === 'login') {
        document.getElementById('login-screen').classList.remove('hidden');
    } else if (screenName === 'admin') {
        document.getElementById('admin-screen').classList.remove('hidden');
        renderAdminQuestions();
    }
}

// Меню инструментов (Тема, Ссылка)
function toggleToolsMenu() {
    document.getElementById('tools-menu').classList.toggle('hidden');
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.body.style.setProperty('--bg-color', '#1e1e24'); // Пример кастомных свойств для вашего CSS
        document.body.style.backgroundColor = '#1e1e24';
        document.body.style.color = '#fff';
    } else {
        document.body.style.backgroundColor = '#f4f4f9';
        document.body.style.color = '#333';
    }
    toggleToolsMenu();
}

function generateShareLink() {
    try {
        const currentQuestions = localStorage.getItem('quiz_questions') || JSON.stringify(defaultQuestions);
        
        // Кодируем строку в Base64 с поддержкой кириллицы
        const encodedData = btoa(encodeURIComponent(currentQuestions));
        
        // Получаем чистый URL текущей страницы без старых ?data=... параметров
        const cleanUrl = window.location.href.split('?')[0];
        
        // Собираем итоговую ссылку для отправки другу
        const shareUrl = cleanUrl + '?data=' + encodedData;
        
        // Проверяем доступность современного метода (работает на HTTPS GitHub Pages)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert("Ссылка на этот тест успешно скопирована! Отправь её друзьям. 🚀");
            }).catch(() => {
                fallbackCopy(shareUrl); // На всякий случай
            });
        } else {
            fallbackCopy(shareUrl); // Если открыли как локальный файл file:///
        }
    } catch (e) {
        alert("Слишком много вопросов в тесте, ссылка превысила лимит длины.");
    }
    toggleToolsMenu();
}

// 4. АВТОРИЗАЦИЯ АДМИНА
function tryLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (user === 'admin' && pass === '1234') {
        // Очищаем форму ввода
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        switchScreen('admin');
    } else {
        alert("Неверный логин или пароль!");
    }
}

function logout() {
    switchScreen('quiz');
}

// 5. ДВИЖОК ТЕСТИРОВАНИЯ (РЕНДЕРИНГ ВОПРОСОВ)
function renderQuestion() {
    clearInterval(currentTimerInterval);
    isExplanationState = false;
    
    if (questions.length === 0) {
        document.getElementById('question-body').innerHTML = "<p>Вопросов пока нет. Зайдите в админку.</p>";
        return;
    }

    const q = questions[currentIndex];
    
    // Обновляем шапку
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;
    
    // Прогресс-бар
    const progressPercent = ((currentIndex) / questions.length) * 100;
    document.getElementById('progress').style.width = `${progressPercent}%`;

    // Кнопка Далее обычная
    const nextBtn = document.getElementById('next-btn');
    nextBtn.innerText = "Далее";
    nextBtn.disabled = false;

    // Сборка тела вопроса в зависимости от типа
    let html = `<h3>${q.title} ${q.required ? '<span style="color:red">*</span>' : ''}</h3>`;
    
    if (q.type === 'radio') {
        q.options.forEach((opt, idx) => {
            html += `<label class="option-label"><input type="radio" name="quiz_ans" value="${idx}"> ${opt}</label><br>`;
        });
    } else if (q.type === 'checkbox') {
        q.options.forEach((opt, idx) => {
            html += `<label class="option-label"><input type="checkbox" name="quiz_ans" value="${idx}"> ${opt}</label><br>`;
        });
    } else if (q.type === 'select') {
        html += `<select id="quiz_select" class="admin-input"><option value="">-- Выберите ответ --</option>`;
        q.options.forEach((opt, idx) => {
            html += `<option value="${idx}">${opt}</option>`;
        });
        html += `</select>`;
    } else if (q.type === 'text') {
        html += `<input type="text" id="quiz_text" class="admin-input" placeholder="Введите ваш ответ...">`;
    }

    // Блок для будущего вывода объяснения
    html += `<div id="explanation-container" class="hidden" style="margin-top:15px; padding:10px; border-radius:6px; background:#fff3cd;"></div>`;

    document.getElementById('question-body').innerHTML = html;

    // Обработка таймера
    const timerDisplay = document.getElementById('timer-display');
    if (q.useTimer && q.timer > 0) {
        timerDisplay.classList.remove('hidden');
        timeLeft = q.timer;
        document.getElementById('timer-seconds').innerText = timeLeft;
        
        currentTimerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('timer-seconds').innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(currentTimerInterval);
                // Автоматический переход или фиксация пропуска при тайм-ауте
                nextStep(true); 
            }
        }, 1000);
    } else {
        timerDisplay.classList.add('hidden');
    }
}

// ОБРАБОТКА НАЖАТИЯ КНОПКИ «ДАЛЕЕ»
function nextStep(isTimeout = false) {
    if (questions.length === 0) return;
    const q = questions[currentIndex];

    // Если сейчас открыто окно объяснения, то по клику просто переходим к следующему вопросу
    if (isExplanationState) {
        currentIndex++;
        if (currentIndex < questions.length) {
            renderQuestion();
        } else {
            showResults();
        }
        return;
    }

    // Собираем ответ пользователя
    let answers = [];
    let rawValue = "";

    if (!isTimeout) {
        if (q.type === 'radio') {
            let checked = document.querySelector('input[name="quiz_ans"]:checked');
            if (checked) { answers.push(parseInt(checked.value)); rawValue = q.options[checked.value]; }
        } else if (q.type === 'checkbox') {
            let checkedBoxes = document.querySelectorAll('input[name="quiz_ans"]:checked');
            checkedBoxes.forEach(cb => {
                answers.push(parseInt(cb.value));
            });
            rawValue = answers.map(i => q.options[i]).join(', ');
        } else if (q.type === 'select') {
            let sel = document.getElementById('quiz_select').value;
            if (sel !== "") { answers.push(parseInt(sel)); rawValue = q.options[sel]; }
        } else if (q.type === 'text') {
            let txt = document.getElementById('quiz_text').value.trim();
            rawValue = txt;
        }

        // Проверка на обязательность
        if (q.required && answers.length === 0 && rawValue === "") {
            alert("Этот вопрос обязателен для ответа!");
            return;
        }
    } else {
        rawValue = "[Время истекло]";
    }

    clearInterval(currentTimerInterval);

    // Проверяем правильность
    let isCorrect = false;
    if (q.type === 'text') {
        if (q.correctText) {
            isCorrect = q.correctText.some(t => t.toLowerCase().trim() === rawValue.toLowerCase().trim());
        }
    } else {
        // Сравнение массивов индексов правильных ответов
        if(q.correct && q.correct.length === answers.length) {
            isCorrect = q.correct.every(v => answers.includes(v));
        }
    }

    // Сохраняем в историю текущей сессии
    userAnswers.push({
        title: q.title,
        userAns: rawValue,
        isCorrect: isCorrect,
        correctInfo: q.type === 'text' ? q.correctText?.join(' / ') : q.correct?.map(i => q.options[i]).join(', ')
    });

    // Проверяем, нужно ли показать блок объяснения перед переходом
    if (q.exp && q.exp.desc && !isTimeout) {
        isExplanationState = true;
        const expBox = document.getElementById('explanation-container');
        expBox.classList.remove('hidden');
        expBox.innerHTML = `<strong>${q.exp.title || 'Объяснение'}:</strong> ${q.exp.desc}`;
        
        const nextBtn = document.getElementById('next-btn');
        nextBtn.innerText = "Продолжить";

        // Проверяем удержание кнопки по таймеру
        if (q.exp.hold > 0) {
            nextBtn.disabled = true;
            let holdTime = q.exp.hold;
            nextBtn.innerText = `Продолжить (${holdTime}s)`;
            let holdInterval = setInterval(() => {
                holdTime--;
                if(holdTime <= 0) {
                    clearInterval(holdInterval);
                    nextBtn.disabled = false;
                    nextBtn.innerText = "Продолжить";
                } else {
                    nextBtn.innerText = `Продолжить (${holdTime}s)`;
                }
            }, 1000);
        }
        return; // Останавливаем выполнение, ждем второго клика по «Продолжить»
    }

    // Переход дальше
    currentIndex++;
    if (currentIndex < questions.length) {
        renderQuestion();
    } else {
        showResults();
    }
}

// 6. ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
function showResults() {
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');
    document.getElementById('progress').style.width = `100%`;

    let score = userAnswers.filter(a => a.isCorrect).length;
    document.getElementById('final-score').innerText = `${score} / ${questions.length}`;

    // Фидбек в зависимости от успешности
    let percent = (score / questions.length) * 100;
    let feedback = "Попробуйте еще раз!";
    if (percent === 100) feedback = "Идеально! Отличный результат! 🏆";
    else if (percent >= 75) feedback = "Хороший результат! У вас отличные знания. 👍";
    else if (percent >= 40) feedback = "Неплохо, но есть что подтянуть. 📈";
    document.getElementById('feedback-text').innerText = feedback;

    // Рендеринг разбора ответов
    let reviewHtml = "<h3>Разбор ваших ответов:</h3>";
    userAnswers.forEach((ans, idx) => {
        reviewHtml += `
            <div style="border-left: 4px solid ${ans.isCorrect ? '#28a745' : '#dc3545'}; padding-left:10px; margin-bottom:10px;">
                <p><strong>${idx + 1}. ${ans.title}</strong></p>
                <p>Ваш ответ: <span style="color:${ans.isCorrect ? 'green' : 'red'}">${ans.userAns || '[Нет ответа]'}</span></p>
                ${!ans.isCorrect ? `<p style="color:#6c757d; font-size:14px;">Правильный: ${ans.correctInfo || '—'}</p>` : ''}
            </div>
        `;
    });
    document.getElementById('review-box').innerHTML = reviewHtml;

    // Сохраняем результаты прохождения в общую историю localStorage
    let totalStats = JSON.parse(localStorage.getItem('quiz_stats') || '[]');
    totalStats.push({ date: new Date().toLocaleString(), score: score, total: questions.length });
    localStorage.setItem('quiz_stats', JSON.stringify(totalStats));
}

function restartQuiz() {
    currentIndex = 0;
    userAnswers = [];
    switchScreen('quiz');
}

// 7. УПРАВЛЕНИЕ АДМИНКОЙ
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

function addQuestion() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();
    const required = document.getElementById('new-required').checked;
    const editable = document.getElementById('new-editable').checked;
    
    const useTimer = document.getElementById('toggle-timer-input').checked;
    const timer = parseInt(document.getElementById('new-timer').value) || 20;

    const useExp = document.getElementById('toggle-exp-input').checked;
    const expTitle = document.getElementById('new-exp-title').value.trim();
    const expDesc = document.getElementById('new-exp-desc').value.trim();
    const expHold = parseInt(document.getElementById('new-exp-timer').value) || 0;

    if (!title) { alert("Заполните текст вопроса!"); return; }

    let newQ = { type, title, required, editable, useTimer, timer };

    if (useExp && expDesc) {
        newQ.exp = { title: expTitle, desc: expDesc, hold: expHold };
    }

    if (type === 'text') {
        const correctTextRaw = document.getElementById('new-correct-text').value;
        if (!correctTextRaw) { alert("Укажите правильный текст!"); return; }
        newQ.correctText = correctTextRaw.split(',').map(s => s.trim());
    } else {
        const optionsRaw = document.getElementById('new-options').value;
        const correctChoicesRaw = document.getElementById('new-correct-choices').value;
        
        if (!optionsRaw || !correctChoicesRaw) { alert("Заполните варианты и индексы правильных ответов!"); return; }
        
        newQ.options = optionsRaw.split(',').map(s => s.trim());
        newQ.correct = correctChoicesRaw.split(',').map(s => parseInt(s.trim()));
    }

    questions.push(newQ);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));

    // Сброс полей
    document.getElementById('new-title').value = '';
    document.getElementById('new-options').value = '';
    document.getElementById('new-correct-choices').value = '';
    document.getElementById('new-correct-text').value = '';
    document.getElementById('new-exp-title').value = '';
    document.getElementById('new-exp-desc').value = '';

    renderAdminQuestions();
    alert("Вопрос успешно сохранен!");
}

function deleteQuestion(index) {
    if (confirm("Вы уверены, что хотите удалить этот вопрос?")) {
        questions.splice(index, 1);
        localStorage.setItem('quiz_questions', JSON.stringify(questions));
        renderAdminQuestions();
    }
}

function renderAdminQuestions() {
    const listContainer = document.getElementById('admin-questions-list');
    listContainer.innerHTML = '';

    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.style = "background:rgba(0,0,0,0.03); padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;";
        item.innerHTML = `
            <div>
                <strong>${index + 1}. [${q.type.toUpperCase()}]</strong> ${q.title} 
                <br><small style="color:#666">Правильный: ${q.type === 'text' ? q.correctText?.join('/') : q.correct?.map(i=>q.options[i]).join(', ')}</small>
            </div>
            <button class="delete-btn" onclick="deleteQuestion(${index})" style="background-color:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; width:auto; margin:0;">Удалить</button>
        `;
        listContainer.appendChild(item);
    });
}

// Запуск при первой загрузке
document.addEventListener("DOMContentLoaded", () => {
    switchScreen('quiz');
});
