// ==========================================
// 1. ПОЛНАЯ БАЗА ДАННЫХ (ДЕФОЛТНЫЕ ВОПРОСЫ)
// ==========================================
const defaultQuestions = [];

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ
// ==========================================
let questions = [];
let currentIndex = 0;
let userAnswers = [];
let currentTimerInterval = null;
let timeLeft = 0;
let isExplanationState = false;
let currentTheme = 'light';

// Надежная загрузка из локальной памяти
function loadQuestions() {
    let saved = localStorage.getItem('quiz_questions');
    if (!saved) {
        localStorage.setItem('quiz_questions', JSON.stringify(defaultQuestions));
        return defaultQuestions;
    }
    try {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch(e) {
        console.error("Ошибка парсинга localStorage", e);
    }
    return defaultQuestions;
}

// ==========================================
// 3. ДВИЖОК ЭКРАНОВ И ИНТЕРФЕЙСА
// ==========================================
function switchScreen(screenName) {
    if (screenName !== 'quiz') clearInterval(currentTimerInterval);

    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('footer-link').classList.add('hidden');

    if (screenName === 'quiz') {
        document.getElementById('quiz-screen').classList.remove('hidden');
        document.getElementById('footer-link').classList.remove('hidden');
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
    
    // Принудительно обновляем цвета при смене экранов
    applyThemeStyles(currentTheme);
}

function toggleToolsMenu() {
    document.getElementById('tools-menu').classList.toggle('hidden');
}

// Фикс тёмной темы для карточек
function setTheme(theme) {
    currentTheme = theme;
    applyThemeStyles(theme);
    toggleToolsMenu();
}

function applyThemeStyles(theme) {
    // Добавили .voice-card в эту строку
    const containers = document.querySelectorAll('.quiz-container, .quiz-box, .result-card, .admin-box, .voice-card');
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

// Полноценная генерация ссылки
function generateShareLink() {
    try {
        const currentQuestions = localStorage.getItem('quiz_questions') || JSON.stringify(defaultQuestions);
        const encodedData = btoa(encodeURIComponent(currentQuestions));
        const cleanUrl = window.location.href.split('?')[0];
        const shareUrl = cleanUrl + '?data=' + encodedData;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert("Ссылка на этот тест успешно скопирована! Отправь её друзьям. 🚀");
            }).catch(() => {
                fallbackCopy(shareUrl);
            });
        } else {
            fallbackCopy(shareUrl);
        }
    } catch (e) {
        alert("Слишком много вопросов, ссылка превысила лимит длины.");
    }
    toggleToolsMenu();
}

// Неубиваемый метод копирования для file:///
function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        if (document.execCommand('copy')) {
            alert("Ссылка успешно скопирована в буфер обмена! 🚀");
        } else {
            prompt("Скопируй вручную:", text);
        }
    } catch (err) {
        prompt("Скопируй вручную:", text);
    }
    document.body.removeChild(textArea);
}

// ==========================================
// 4. АВТОРИЗАЦИЯ
// ==========================================
function tryLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (user === 'admin' && pass === '1234') {
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

// ==========================================
// 5. ДВИЖОК ТЕСТИРОВАНИЯ
// ==========================================
let currentVoiceAnswer = null; // статус голосового ответа текущего вопроса

function renderQuestion() {
    clearInterval(currentTimerInterval);
    isExplanationState = false;
    currentVoiceAnswer = null; 
    
    // Если база вопросов пуста, показываем красивую заглушку
    if (!questions || questions.length === 0) {
        document.getElementById('question-body').innerHTML = `
            <div style="text-align: center; padding: 30px 10px;">
                <h3 style="margin-bottom: 15px;">У вас нет форм 🤷‍♂️</h3>
                <p style="color: var(--text-muted); font-size: 15px; margin-bottom: 20px;">Создайте их через панель управления.</p>
                <button onclick="switchScreen('login')" style="width: auto; display: inline-block; padding: 10px 20px; font-size: 14px;">Перейти в админку</button>
            </div>
        `;
        // Скрываем кнопку "Далее", так как нажимать пока не на что
        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('current-number').innerText = "0";
        document.getElementById('total-number').innerText = "0";
        return;
    }
    
    // Если вопросы есть, возвращаем кнопку "Далее" на место
    document.getElementById('next-btn').classList.remove('hidden');
    
    if (q.type === 'radio') {
        q.options.forEach((opt, idx) => {
            html += `<label class="option-label" style="display:block; margin: 8px 0;"><input type="radio" name="quiz_ans" value="${idx}"> ${opt}</label>`;
        });
    } else if (q.type === 'checkbox') {
        q.options.forEach((opt, idx) => {
            html += `<label class="option-label" style="display:block; margin: 8px 0;"><input type="checkbox" name="quiz_ans" value="${idx}"> ${opt}</label>`;
        });
    } else if (q.type === 'select') {
        html += `<select id="quiz_select" class="admin-input" style="width:100%; padding:8px; margin-top:10px;"><option value="">-- Выберите ответ --</option>`;
        q.options.forEach((opt, idx) => {
            html += `<option value="${idx}">${opt}</option>`;
        });
        html += `</select>`;
    } else if (q.type === 'text') {
        html += `<input type="text" id="quiz_text" class="admin-input" style="width:100%; padding:8px; margin-top:10px;" placeholder="Введите ваш ответ...">`;
    } else if (q.type === 'voice_card') {
        const correctStr = q.correctText ? q.correctText.join(', ') : '';
        html = `
            <div class="voice-card" onclick="handleVoiceCardFail()">
                <h3>${q.title}</h3>
                <button class="voice-btn" id="mic-btn" onclick="startVoiceRecognition(event, '${correctStr}')">
                    🎤 Нажать и сказать
                </button>
                <div class="voice-status" id="voice-status">Нажмите кнопку, чтобы ответить голосом. Нажмите на саму карточку, если не знаете ответ.</div>
            </div>
        `;
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
            if (timeLeft <= 0) {
                clearInterval(currentTimerInterval);
                nextStep(true); 
            }
        }, 1000);
    } else {
        timerDisplay.classList.add('hidden');
    }
}

function nextStep(isTimeout = false) {
    if (questions.length === 0) return;
    const q = questions[currentIndex];
    if (isExplanationState) {
        currentIndex++;
        if (currentIndex < questions.length) {
            renderQuestion();
        } else {
            showResults();
        }
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
            let txt = document.getElementById('quiz_text').value.trim();
            rawValue = txt;
        } else if (q.type === 'voice_card') {
            if (currentVoiceAnswer === null) {
                alert("Пожалуйста, ответьте голосом или нажмите на карточку, если не знаете ответ!");
                return;
            }
            rawValue = currentVoiceAnswer;
        }
        
        if (q.required && answers.length === 0 && rawValue === "" && q.type !== 'voice_card') {
            alert("Этот вопрос обязателен для ответа!");
            return;
        }
    } else {
        rawValue = "[Время истекло]";
    }

    clearInterval(currentTimerInterval);
    let isCorrect = false;
    
    if (q.type === 'text' || q.type === 'voice_card') {
        if (q.correctText) {
            isCorrect = q.correctText.some(t => t.toLowerCase().trim() === rawValue.toLowerCase().trim());
        }
    } else {
        if(q.correct && q.correct.length === answers.length) {
            isCorrect = q.correct.every(v => answers.includes(v));
        }
    }
    
    userAnswers.push({
        title: q.title,
        userAns: rawValue,
        isCorrect: isCorrect,
        correctInfo: (q.type === 'text' || q.type === 'voice_card') ? q.correctText?.join(' / ') : q.correct?.map(i => q.options[i]).join(', ')
    });
    
    if (q.exp && q.exp.desc && !isTimeout) {
        isExplanationState = true;
        const expBox = document.getElementById('explanation-container');
        expBox.classList.remove('hidden');
        expBox.innerHTML = `<strong>${q.exp.title || 'Объяснение'}:</strong> ${q.exp.desc}`;
        
        const nextBtn = document.getElementById('next-btn');
        nextBtn.innerText = "Продолжить";
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
        return;
    }
    
    currentIndex++;
    if (currentIndex < questions.length) {
        renderQuestion();
    } else {
        showResults();
    }
}

function restartQuiz() {
    currentIndex = 0;
    userAnswers = [];
    switchScreen('quiz');
}

// ==========================================
// 5.1 ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ГОЛОСОВЫХ КАРТОЧЕК
// ==========================================

function handleVoiceCardFail() {
    const statusDisplay = document.getElementById('voice-status');
    if (statusDisplay) {
        statusDisplay.innerText = "❌ Вы отметили этот ответ как неверный.";
    }
    
    currentVoiceAnswer = "[Не знаю ответ]"; 
    
    const card = document.querySelector('.voice-card');
    if (card) card.style.borderColor = '#ff4d4f';
    
    setTimeout(() => {
        nextStep();
    }, 800);
}

function startVoiceRecognition(event, correctAnswersStr) {
    event.stopPropagation(); 
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("К сожалению, ваш браузер не поддерживает распознавание речи. Пожалуйста, используйте Google Chrome.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU'; 
    recognition.interimResults = false;
    
    const btn = document.getElementById('mic-btn');
    const statusDisplay = document.getElementById('voice-status');
    const card = document.querySelector('.voice-card');
    
    btn.classList.add('recording');
    btn.innerText = "🛑 Слушаю...";
    statusDisplay.innerText = "Говорите слово...";

    recognition.start();

    recognition.onresult = function(e) {
        const userSpeech = e.results.transcript.trim();
        statusDisplay.innerText = `Вы сказали: "${userSpeech}"`;
        
        currentVoiceAnswer = userSpeech;

        const allowedAnswers = correctAnswersStr.split(',').map(item => item.trim().toLowerCase());

        if (allowedAnswers.includes(userSpeech.toLowerCase())) {
            statusDisplay.innerHTML = `🎉 <strong>Правильно!</strong> Вы сказали: "${userSpeech}"`;
            if (card) card.style.borderColor = '#52c41a'; 
        } else {
            statusDisplay.innerHTML = `❌ <strong>Неверно.</strong> Вы сказали: "${userSpeech}".<br><small>Ожидалось: ${correctAnswersStr}</small>`;
            if (card) card.style.borderColor = '#ff4d4f'; 
        }
    };

    recognition.onerror = function() {
        statusDisplay.innerText = "Ошибка распознавания. Попробуйте еще раз.";
        resetMicButton(btn);
    };

    recognition.onend = function() {
        resetMicButton(btn);
    };
}

function resetMicButton(btn) {
    if (btn) {
        btn.classList.remove('recording');
        btn.innerText = "🎤 Нажать и сказать";
    }
}

// ==========================================
// 6. СБОР РЕЗУЛЬТАТОВ (НОВОВВЕДЕНИЯ)
// ==========================================
function showResults() {
    document.getElementById('quiz-box').classList.add('hidden');
    const resultBox = document.getElementById('result-box');
    resultBox.classList.remove('hidden');
    document.getElementById('progress').style.width = `100%`;

    let score = userAnswers.filter(a => a.isCorrect).length;
    document.getElementById('final-score').innerText = `${score} / ${questions.length}`;

    let percent = (score / questions.length) * 100;
    let feedback = "Попробуйте еще раз!";
    if (percent === 100) feedback = "Идеально! Отличный результат! 🏆";
    else if (percent >= 75) feedback = "Хороший результат! У вас отличные знания. 👍";
    else if (percent >= 40) feedback = "Неплохо, но есть что подтянуть. 📈";
    document.getElementById('feedback-text').innerText = feedback;

    let reviewHtml = "<h3>Разбор ваших ответов:</h3>";
    userAnswers.forEach((ans, idx) => {
        reviewHtml += `
            <div style="border-left: 4px solid ${ans.isCorrect ? '#28a745' : '#dc3545'}; padding-left:10px; margin-bottom:10px; text-align:left;">
                <p><strong>${idx + 1}. ${ans.title}</strong></p>
                <p>Ваш ответ: <span style="color:${ans.isCorrect ? 'green' : 'red'}">${ans.userAns || '[Нет ответа]'}</span></p>
                ${!ans.isCorrect ? `<p style="color:#6c757d; font-size:14px;">Правильный: ${ans.correctInfo || '—'}</p>` : ''}
            </div>
        `;
    });
    document.getElementById('review-box').innerHTML = reviewHtml;

    // Сбор результатов для учителя
    let oldForm = document.getElementById('teacher-submission-block');
    if (oldForm) oldForm.remove();

    const shareResultsDiv = document.createElement('div');
    shareResultsDiv.id = 'teacher-submission-block';
    shareResultsDiv.style = "margin-top: 20px; padding: 15px; background: rgba(40, 167, 69, 0.15); border-radius: 8px; text-align: center; border: 1px solid #28a745;";

    let studentName = prompt("Введите ваше Имя и Фамилию для отчета:") || "Аноним";

    let reportData = {
        student: studentName,
        score: `${score} / ${questions.length}`,
        date: new Date().toLocaleString(),
        answers: userAnswers.map(a => ({q: a.title, ans: a.userAns, correct: a.isCorrect}))
    };

    let encodedResults = btoa(encodeURIComponent(JSON.stringify(reportData)));

    shareResultsDiv.innerHTML = `
        <h3 style="color:#28a745; margin-top:0;">📥 Сдача работы учителю</h3>
        <p style="font-size:14px;">Чтобы сдать тест, скопируйте код ответов или скачайте текстовый файл отчета и передайте его преподавателю.</p>
        <button id="copy-code-btn" style="background-color: #28a745; color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; width:100%; font-weight:bold; margin-bottom:10px;">📋 Копировать код ответов</button>
        <button id="download-txt-btn" style="background-color: #17a2b8; color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; width:100%; font-weight:bold;">💾 Скачать файл отчета (.txt)</button>
    `;

    resultBox.appendChild(shareResultsDiv);

    // ВОТ ЗДЕСЬ ТЫ ЗАСТРЯЛ: ПОЛНАЯ ЛОГИКА КНОПОК
    document.getElementById('copy-code-btn').addEventListener('click', () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(encodedResults).then(() => {
                alert('Код ответов скопирован! Отправь его учителю.');
            }).catch(() => {
                fallbackCopy(encodedResults);
            });
        } else {
            fallbackCopy(encodedResults);
        }
    });

    document.getElementById('download-txt-btn').addEventListener('click', () => {
        let textContent = `ОТЧЕТ О ПРОХОЖДЕНИИ ТЕСТА\nУченик: ${reportData.student}\nРезультат: ${reportData.score}\nДата: ${reportData.date}\n\n`;
        reportData.answers.forEach((a, i) => {
            textContent += `${i+1}. ${a.q}\nОтвет: ${a.ans} (${a.correct ? 'ВЕРНО' : 'НЕВЕРНО'})\n\n`;
        });
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Тест_${reportData.student}.txt`;
        link.click();
    });

    let totalStats = JSON.parse(localStorage.getItem('quiz_stats') || '[]');
    totalStats.push({ date: reportData.date, score: score, total: questions.length });
    localStorage.setItem('quiz_stats', JSON.stringify(totalStats));
}

function restartQuiz() {
    currentIndex = 0;
    userAnswers = [];
    switchScreen('quiz');
}

// ==========================================
// 7. УПРАВЛЕНИЕ АДМИНКОЙ
// ==========================================
function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    const choicesFields = document.getElementById('admin-choices-fields');
    const textFields = document.getElementById('admin-text-fields');

    if (type === 'text' || type === 'voice_card') {
        choicesFields.classList.add('hidden');
        textFields.classList.remove('hidden');
    } else {
        choicesFields.classList.remove('hidden');
        textFields.classList.add('hidden');
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
    
    // Новое: обрабатываем правильный ответ для текста И для голосовых карточек
    if (type === 'text' || type === 'voice_card') {
        const correctTextRaw = document.getElementById('new-correct-text').value;
        if (!correctTextRaw) { alert("Укажите правильный текст!"); return; }
        newQ.correctText = correctTextRaw.split(',').map(s => s.trim());
    } else {
        const optionsRaw = document.getElementById('new-options').value;
        const correctChoicesRaw = document.getElementById('new-correct-choices').value;
        
        if (!optionsRaw || !correctChoicesRaw) { 
            alert("Заполните варианты и индексы ответов!"); 
            return; 
        }
        
        newQ.options = optionsRaw.split(',').map(s => s.trim());
        newQ.correct = correctChoicesRaw.split(',').map(s => parseInt(s.trim()));
    }
    
    questions.push(newQ);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    
    // Очищаем поля формы после сохранения
    document.getElementById('new-title').value = '';
    document.getElementById('new-options').value = '';
    document.getElementById('new-correct-choices').value = '';
    document.getElementById('new-correct-text').value = '';
    document.getElementById('new-exp-title').value = '';
    document.getElementById('new-exp-desc').value = '';
    
    renderAdminQuestions();
    alert("Вопрос сохранен!");
}

function deleteQuestion(index) {
    if (confirm("Удалить этот вопрос?")) {
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
        item.style = "background:rgba(0,0,0,0.03); padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center; text-align:left; color:inherit;";
        item.innerHTML = `
            <div>
                <strong>${index + 1}. [${q.type.toUpperCase()}]</strong> ${q.title} 
                <br><small>Ответ: ${q.type === 'text' ? q.correctText?.join('/') : q.correct?.map(i=>q.options[i]).join(', ')}</small>
            </div>
            <button onclick="deleteQuestion(${index})" style="background-color:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; width:auto; margin:0;">Удалить</button>
        `;
        listContainer.appendChild(item);
    });
}

// ==========================================
// 8. ЗАЩИЩЕННЫЙ ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('data');

    currentIndex = 0;
    userAnswers = [];

    if (sharedData) {
        try {
            const decodedString = decodeURIComponent(atob(sharedData));
            const parsedQuestions = JSON.parse(decodedString);
            
            if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
                questions = parsedQuestions;
                console.log("Загружен тест по ссылке. Вопросов:", questions.length);
            } else {
                throw new Error("Пустой массив данных");
            }
        } catch (e) {
            console.error("Ошибка парсинга ссылки, грузим локальную базу.", e);
            questions = loadQuestions();
        }
    } else {
        questions = loadQuestions();
    }

    if (!questions || questions.length === 0) {
        questions = defaultQuestions;
    }

    switchScreen('quiz');
});

// Этот кусок кода нужно встроить в вашу функцию отрисовки вопросов
function renderQuestion(question) {
    const container = document.getElementById('question-body');
    container.innerHTML = ''; // Очищаем старый контент

    // ... тут ваш старый код для radio, checkbox, text ...

    if (question.type === 'voice_card') {
        const cardHtml = `
            <div class="voice-card" onclick="handleVoiceCardFail()">
                <h3>${question.title}</h3>
                <button class="voice-btn" id="mic-btn" onclick="startVoiceRecognition(event, '${question.correctText}')">
                    🎤 Нажать и сказать
                </button>
                <div class="voice-status" id="voice-status">Нажмите кнопку, чтобы ответить голосом. Нажмите на саму карточку, если не знаете ответ.</div>
            </div>
        `;
        container.innerHTML = cardHtml;
    }
}
