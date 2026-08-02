// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И МУЛЬТИФОРМЫ
// ==========================================
let allForms = JSON.parse(localStorage.getItem('q_forms')) || {"def": {id: "def", name: "Главная форма", questions: []}};
let currentFormId = localStorage.getItem('q_curr_id') || "def";
if (!allForms[currentFormId]) currentFormId = Object.keys(allForms)[0] || "def";

let questions = allForms[currentFormId].questions;
let currentIndex = 0, userAnswers = [], currentTimerInterval = null, timeLeft = 0;
let isExplanationState = false, currentVoiceAnswer = null;
let previewTimer = null; 

const save = () => {
    localStorage.setItem('q_forms', JSON.stringify(allForms));
    localStorage.setItem('q_curr_id', currentFormId);
    questions = allForms[currentFormId].questions;
    renderTabs();
};

window.onload = async () => { 
    const urlParams = new URLSearchParams(window.location.search);
    
    const previewData = urlParams.get('preview_q');
    const expiresAt = parseInt(urlParams.get('expires') || "0");

    if (previewData) {
        if (Date.now() > expiresAt) {
            document.body.innerHTML = `
                <div style="display:flex; height:100vh; flex-direction:column; align-items:center; justify-content:center; background:#121212; color:#ff4d4d; font-family:sans-serif; text-align:center; padding:20px;">
                    <span class="material-symbols-rounded" style="font-size:64px; margin-bottom:10px;">timer_off</span>
                    <h2>Ссылка недействительна</h2>
                    <p style="color:#aaa;">Срок действия предпросмотра (5 минут) истёк.</p>
                </div>`;
            return;
        }

        try {
            let base64 = previewData.replace(/-/g, "+").replace(/_/g, "/");
            while (base64.length % 4) base64 += "=";
            const binaryStr = atob(base64);
            const byteArray = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) byteArray[i] = binaryStr.charCodeAt(i);
            
            const stream = new Response(byteArray).body.pipeThrough(new DecompressionStream("deflate"));
            const jsonStr = await new Response(stream).text();
            const singleQuestion = JSON.parse(jsonStr);

            allForms = { "preview": { id: "preview", name: "Предпросмотр", questions: [singleQuestion] } };
            currentFormId = "preview";
            questions = [singleQuestion];
            
            // Скрываем лишние элементы UI при предпросмотре
            document.querySelector('.forms-tabs-container').style.display = 'none';
            document.querySelector('.tools-dropdown').style.display = 'none';
            document.getElementById('footer-link').style.display = 'none';
            const promo = document.querySelector('.promo-banner'); if (promo) promo.style.display = 'none';

            setTimeout(() => { window.location.reload(); }, expiresAt - Date.now());
        } catch (e) {
            document.body.innerHTML = `<h3 style="color:red; text-align:center; padding-top:50px;">Ошибка загрузки предпросмотра</h3>`;
            return;
        }
    } 

    const savedTheme = localStorage.getItem('quiz_theme') || 'light';
    setTheme(savedTheme);
    save(); 
    renderQuestion(); 
};

function renderTabs() {
    const box = document.getElementById('forms-tabs-list');
    if (!box) return;
    box.innerHTML = Object.keys(allForms).map(id => `
        <div class="form-tab ${id === currentFormId ? 'active-tab' : ''}" onclick="switchForm('${id}')">
            <span>${allForms[id].name}</span>
            <div class="tab-actions">
                <button class="tab-action-btn" onclick="renameForm(event, '${id}')" title="Переименовать форму">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="tab-action-btn" onclick="deleteForm(event, '${id}')" title="Удалить форму">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
        </div>
    `).join('');
}

function renameForm(e, id) {
    e.stopPropagation();
    const currentName = allForms[id].name;
    let newName = prompt("Новое название формы:", currentName);
    if (!newName || !newName.trim()) return;
    allForms[id].name = newName.trim();
    save();
    renderTabs();
}

const switchForm = id => { 
    if(currentFormId !== id) { 
        currentFormId = id; currentIndex = 0; userAnswers = []; save(); renderQuestion(); 
    }
};

function createNewFormPrompt() {
    let name = prompt("Название новой формы:", "Новая форма");
    if (!name?.trim()) return;
    let id = 'f_' + Date.now();
    allForms[id] = { id, name: name.trim(), questions: [] };
    currentFormId = id; currentIndex = 0; userAnswers = []; save(); renderQuestion();
}

function deleteForm(e, id) {
    e.stopPropagation();
    if (!confirm(`Удалить форму "${allForms[id].name}"?`)) return;
    delete allForms[id];
    if (currentFormId === id) currentFormId = Object.keys(allForms)[0] || "def";
    if (!allForms[currentFormId]) allForms[currentFormId] = { id: currentFormId, name: "Главная форма", questions: [] };
    currentIndex = 0; userAnswers = []; save(); renderQuestion();
}

// ==========================================
// 2. ДВИЖОК ТЕСТИРОВАНИЯ
// ==========================================
function renderQuestion() {
    clearInterval(currentTimerInterval);
    isExplanationState = false; currentVoiceAnswer = null;
    
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) { nextBtn.innerText = "Далее"; nextBtn.disabled = false; nextBtn.classList.remove('hidden'); }
    
    document.getElementById('hint-box').classList.add('hidden');
    document.getElementById('hint-btn').classList.add('hidden');

    if (!questions?.length) {
        document.getElementById('question-body').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <h3>В этой форме нет вопросов 🤷‍♂️</h3><p style="color:var(--text-muted);">Создайте их через панель администратора.</p>
                <button onclick="switchScreen('login')" style="width:auto; display:inline-block; padding:10px 20px;">Перейти в редактор</button>
            </div>`;
        if (nextBtn) nextBtn.classList.add('hidden');
        document.getElementById('current-number').innerText = document.getElementById('total-number').innerText = "0";
        return;
    }
    
    const q = questions[currentIndex];
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;
    document.getElementById('progress').style.width = `${(currentIndex / questions.length) * 100}%`;

    // Подсказка
    if (q.hint && q.hint.trim() !== '') {
        document.getElementById('hint-btn').classList.remove('hidden');
        document.getElementById('hint-text').innerText = q.hint;
    }

    let html = `
        <h3 style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>${q.title}</span> ${q.required ? '<span style="color:red">*</span>' : ''}
            <button class="speak-btn" onclick="speakText('${q.title.replace(/'/g, "\\'")}')" title="Озвучить вопрос">
                <span class="material-symbols-rounded" style="font-size: 16px;">volume_up</span>
            </button>
        </h3>`;

    if (q.type === 'radio' || q.type === 'checkbox') {
        q.options.forEach((opt, i) => html += `<label class="option"><input type="${q.type}" name="quiz_ans" value="${i}"> ${opt}</label>`);
    } else if (q.type === 'select') {
        html += `<select id="quiz_select" class="admin-input"><option value="">-- Выберите ответ --</option>` + q.options.map((opt, i) => `<option value="${i}">${opt}</option>`).join('') + `</select>`;
    } else if (q.type === 'text') {
        html += `<input type="text" id="quiz_text" class="admin-input" placeholder="Введите ваш ответ...">`;
    } else if (q.type === 'voice_card') {
        html += `
            <div class="voice-card" onclick="handleVoiceCardFail()">
                <h3>${q.title}</h3>
                <div style="display:flex; flex-direction:column; gap:8px; align-items:center;">
                    <button class="voice-btn" id="mic-btn" onclick="startVoiceRecognition(event, '${q.correctText?.join(',') || ''}')">
                        <span class="material-symbols-rounded">mic</span> Нажать и сказать
                    </button>
                    <button class="skip-voice-btn" onclick="event.stopPropagation(); handleVoiceCardFail('Не могу говорить');">
                        <span class="material-symbols-rounded" style="font-size:16px;">volume_off</span> Я не могу говорить
                    </button>
                </div>
                <div class="voice-status" id="voice-status">Скажите ответ или нажмите на карточку, чтобы посмотреть его.</div>
            </div>`;
    } else if (q.type === 'flashcard') {
        html = `
            <div class="flashcard-container" onclick="flipCard()">
                <div class="flashcard" id="main-flashcard">
                    <div class="flashcard-front">
                        <span class="flashcard-word">${q.title}</span>
                        <button class="speak-btn" onclick="event.stopPropagation(); speakText('${q.title.replace(/'/g, "\\'")}')">
                            <span class="material-symbols-rounded">volume_up</span> Озвучить
                        </button>
                    </div>
                    <div class="flashcard-back">
                        <span class="flashcard-word">${q.correctText ? q.correctText.join(' / ') : (q.answer || '')}</span>
                    </div>
                </div>
            </div>
            <div class="flashcard-controls">
                <button class="btn-secondary" onclick="knowWord(false)">❌ Записать в словарь</button>
                <button class="btn-primary" onclick="knowWord(true)">✅ Я знал это</button>
            </div>`;
    }

    document.getElementById('question-body').innerHTML = html + `<div id="explanation-container" class="hidden" style="margin-top:15px; padding:15px; border-radius:12px; background:var(--bg-option-hover); border: 1px solid var(--border-color); color:var(--text-main);"></div>`;

    const tDisplay = document.getElementById('timer-display');
    if (q.useTimer && q.timer > 0) {
        if (tDisplay) tDisplay.classList.remove('hidden');
        timeLeft = q.timer; document.getElementById('timer-seconds').innerText = timeLeft;
        currentTimerInterval = setInterval(() => {
            timeLeft--; document.getElementById('timer-seconds').innerText = timeLeft;
            if (timeLeft <= 0) { clearInterval(currentTimerInterval); nextStep(true); }
        }, 1000);
    } else { if(tDisplay) tDisplay.classList.add('hidden'); }
}

function flipCard() {
    const card = document.getElementById('main-flashcard');
    if (card) card.classList.toggle('flipped');
}

function knowWord(isKnown) {
    const q = questions[currentIndex];
    userAnswers.push({
        title: q.title, userAns: isKnown ? "Знаю" : "Не знаю",
        finalStatus: isKnown ? "correct" : "incorrect",
        correctInfo: q.correctText ? q.correctText.join(' / ') : (q.answer || '')
    });
    currentIndex++;
    if (currentIndex < questions.length) renderQuestion(); else showResults();
}

function nextStep(isTimeout = false) {
    if (!questions?.length) return;
    const q = questions[currentIndex];

    if (isExplanationState) {
        currentIndex++;
        if (currentIndex < questions.length) renderQuestion(); else showResults();
        return;
    }

    let answers = [], rawValue = "", voiceStatus = null;

    if (!isTimeout) {
        if (q.type === 'radio') {
            let checked = document.querySelector('input[name="quiz_ans"]:checked');
            if (checked) { answers.push(parseInt(checked.value)); rawValue = q.options[checked.value]; }
        } else if (q.type === 'checkbox') {
            let checkedBoxes = document.querySelectorAll('input[name="quiz_ans"]:checked');
            checkedBoxes.forEach(cb => answers.push(parseInt(cb.value)));
            rawValue = answers.map(i => q.options[i]).join(', ');
        } else if (q.type === 'select') {
            let sel = document.getElementById('quiz_select').value;
            if (sel !== "") { answers.push(parseInt(sel)); rawValue = q.options[sel]; }
        } else if (q.type === 'text') {
            rawValue = document.getElementById('quiz_text').value.trim();
        } else if (q.type === 'voice_card') {
            if (currentVoiceAnswer === null) { alert("Ответьте голосом или откройте карточку!"); return; }
            rawValue = currentVoiceAnswer.text;
            voiceStatus = currentVoiceAnswer.status;
        }

        if (q.required && answers.length === 0 && rawValue === "" && q.type !== 'voice_card' && q.type !== 'flashcard') { 
            alert("Этот вопрос обязателен!"); return; 
        }
    } else { rawValue = "[Время истекло]"; }

    clearInterval(currentTimerInterval);
    let finalStatus = "incorrect"; 

    if (q.type === 'voice_card' && voiceStatus) {
        finalStatus = voiceStatus;
    } else if (q.type === 'text') {
        if (q.correctText) {
            let ok = q.correctText.some(t => t.toLowerCase().trim() === rawValue.toLowerCase().trim());
            finalStatus = ok ? "correct" : "incorrect";
        }
    } else if (q.type !== 'flashcard') {
        if (q.correct && q.correct.length === answers.length) {
            let ok = q.correct.every(v => answers.includes(v));
            finalStatus = ok ? "correct" : "incorrect";
        }
    }

    userAnswers.push({ 
        title: q.title, userAns: rawValue, finalStatus: finalStatus, 
        correctInfo: (q.type === 'text' || q.type === 'voice_card') ? q.correctText?.join(' / ') : q.correct?.map(i => q.options[i]).join(', ') 
    });

    if (q.exp && q.exp.desc && !isTimeout) {
        isExplanationState = true;
        const expBox = document.getElementById('explanation-container');
        if (expBox) {
            expBox.classList.remove('hidden'); 
            expBox.innerHTML = `<strong>${q.exp.title || 'Объяснение'}:</strong> ${q.exp.desc}`;
        }
        const nextBtn = document.getElementById('next-btn');
        if (q.exp.hold > 0 && nextBtn) {
            nextBtn.disabled = true; let holdTime = q.exp.hold; nextBtn.innerText = `Продолжить (${holdTime}s)`;
            let holdInterval = setInterval(() => {
                holdTime--; nextBtn.innerText = `Продолжить (${holdTime}s)`;
                if (holdTime <= 0) { clearInterval(holdInterval); nextBtn.disabled = false; nextBtn.innerText = "Продолжить"; }
            }, 1000);
        } else if (nextBtn) { nextBtn.innerText = "Продолжить"; }
        return;
    }

    currentIndex++;
    if (currentIndex < questions.length) renderQuestion(); else showResults();
}

function showResults() {
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');
    let correctCount = userAnswers.filter(a => a.finalStatus === "correct").length;
    document.getElementById('final-score').innerText = `${correctCount} / ${userAnswers.length}`;
    
    document.getElementById('review-box').innerHTML = userAnswers.map(a => {
        let itemClass = a.finalStatus === "correct" ? "correct-item" : "incorrect-item";
        return `
            <div class="review-item ${itemClass}">
                <strong>${a.title}</strong><br>
                Ваш ответ: <span>${a.userAns || '[Пусто]'}</span><br>
                Правильный: <span class="text-success">${a.correctInfo || '[Нет данных]'}</span>
            </div>`;
    }).join('');
}

function restartQuiz() {
    currentIndex = 0; userAnswers = [];
    document.getElementById('result-box').classList.add('hidden');
    document.getElementById('quiz-box').classList.remove('hidden');
    renderQuestion();
}

// ==========================================
// 3. ДОПОЛНИТЕЛЬНЫЕ ИНТЕРФЕЙСНЫЕ ФУНКЦИИ
// ==========================================
function toggleHintModal() {
    document.getElementById('hint-box').classList.toggle('hidden');
}

function toggleToolsMenu() {
    document.getElementById('tools-menu').classList.toggle('hidden');
}
// Закрытие меню опций при клике вне
document.addEventListener('click', function(e) {
    const btn = document.querySelector('.tools-btn');
    const menu = document.getElementById('tools-menu');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

function handleVoiceCardFail(reason = "Подсмотрел(-а)") {
    const status = document.getElementById('voice-status');
    const q = questions[currentIndex];
    const firstCorrectAnswer = q.correctText ? q.correctText[0] : '';
    if (status) status.innerHTML = `⚠️ <strong>${reason}:</strong> Ответ был: "${q.correctText?.join(' / ')}"`;
    if (firstCorrectAnswer) speakText(firstCorrectAnswer);
    currentVoiceAnswer = { text: `[${reason}]`, status: "skipped" };
    setTimeout(() => nextStep(), 1800);
}

function startVoiceRecognition(event, correctAnswersStr) {
    event.stopPropagation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Ваш браузер не поддерживает распознавание речи."); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU'; recognition.interimResults = false;
    const btn = document.getElementById('mic-btn'), status = document.getElementById('voice-status');
    
    if (btn) btn.innerText = "Слушаю...";
    recognition.start();

    recognition.onresult = function(e) {
        const userSpeech = e.results[0][0].transcript.trim();
        const allowed = correctAnswersStr.split(',').map(item => item.trim().toLowerCase());
        
        if (allowed.includes(userSpeech.toLowerCase())) {
            if (status) status.innerHTML = `🎉 <strong>Правильно!</strong> (${userSpeech})`;
            currentVoiceAnswer = { text: userSpeech, status: "correct" };
        } else {
            if (status) status.innerHTML = `❌ <strong>Неверно:</strong> "${userSpeech}"`;
            currentVoiceAnswer = { text: userSpeech, status: "incorrect" };
        }
    };
}

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[a-zA-Z]/.test(text) ? 'en-US' : 'ru-RU';
    window.speechSynthesis.speak(utterance);
}

function setTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-theme'); 
    else document.body.classList.remove('dark-theme');
    localStorage.setItem('quiz_theme', theme);
}

function switchScreen(screen) {
    document.getElementById('quiz-screen').classList.toggle('hidden', screen !== 'quiz');
    document.getElementById('login-screen').classList.toggle('hidden', screen !== 'login');
    document.getElementById('admin-screen').classList.toggle('hidden', screen !== 'admin');
    if (screen === 'admin') {
        document.getElementById('admin-add-form').classList.add('hidden'); // Скрываем редактор по умолчанию
        renderAdminQuestions();
    }
}

function tryLogin() {
    if (document.getElementById('login-user').value === 'admin' && document.getElementById('login-pass').value === '1234') {
        switchScreen('admin');
        document.getElementById('login-pass').value = '';
    } else { alert("Неверный логин или пароль!"); }
}

function logout() { switchScreen('quiz'); }

// ПЕЧАТЬ ФОРМЫ (ТЕСТА)
function printCurrentForm() {
    document.getElementById('tools-menu').classList.add('hidden');
    const form = allForms[currentFormId];
    if (!form || !form.questions || form.questions.length === 0) {
        alert("В этой форме нет вопросов для печати!");
        return;
    }

    let printWindow = window.open('', '_blank');
    let html = `
    <html><head><title>Печать: ${form.name}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #000; line-height: 1.5; }
        h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
        .q-box { margin-bottom: 25px; page-break-inside: avoid; }
        .q-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
        .q-opts { margin-left: 20px; font-size: 14px; margin-bottom: 5px; }
        .q-line { margin-top: 10px; border-bottom: 1px solid #000; width: 100%; height: 20px; }
    </style></head><body>`;
    
    html += `<h1>${form.name}</h1>`;
    
    form.questions.forEach((q, i) => {
        html += `<div class="q-box"><div class="q-title">${i + 1}. ${q.title}</div>`;
        if (q.type === 'radio' || q.type === 'checkbox') {
            q.options.forEach(opt => { html += `<div class="q-opts">○ ${opt}</div>`; });
        } else {
            html += `<div class="q-line"></div>`;
        }
        html += `</div>`;
    });

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Небольшая задержка для рендера браузером
    setTimeout(() => { printWindow.print(); }, 250);
}

// ==========================================
// 4. ПАНЕЛЬ АДМИНИСТРАТОРА (СОЗДАНИЕ / РЕДАКТИРОВАНИЕ)
// ==========================================

function toggleAddQuestionForm() {
    const form = document.getElementById('admin-add-form');
    if (form) form.classList.toggle('hidden');
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    document.getElementById('admin-choices-fields').classList.toggle('hidden', (type === 'text' || type === 'voice_card' || type === 'flashcard'));
    document.getElementById('admin-text-fields').classList.toggle('hidden', (type === 'radio' || type === 'checkbox' || type === 'select' || type === 'flashcard'));
    
    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('title-label').innerText = type === 'flashcard' ? "Слово на лицевой стороне:" : "Текст вопроса:";
}

function addQuestion() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();
    if (!title) { alert("Введите текст вопроса!"); return; }

    let q = {
        type: type,
        title: title,
        required: document.getElementById('new-required').checked
    };

    if (document.getElementById('toggle-timer-input').checked) {
        q.useTimer = true;
        q.timer = parseInt(document.getElementById('new-timer').value) || 20;
    }

    if (document.getElementById('toggle-hint-input').checked) {
        q.hint = document.getElementById('new-hint-text').value.trim();
    }

    if (document.getElementById('toggle-exp-input').checked) {
        q.exp = {
            title: document.getElementById('new-exp-title').value.trim(),
            desc: document.getElementById('new-exp-desc').value.trim(),
            hold: parseInt(document.getElementById('new-exp-timer').value) || 0
        };
    }

    if (type === 'radio' || type === 'checkbox' || type === 'select') {
        let opts = document.getElementById('new-options').value.split(',').map(s => s.trim()).filter(s => s);
        let correctIdx = document.getElementById('new-correct-choices').value.split(',').map(s => parseInt(s.trim()));
        if (opts.length === 0) { alert("Добавьте варианты ответов!"); return; }
        q.options = opts;
        q.correct = correctIdx;
    } else if (type === 'text' || type === 'voice_card') {
        let textAns = document.getElementById('new-correct-text').value.split(',').map(s => s.trim()).filter(s => s);
        if (textAns.length === 0) { alert("Добавьте правильный ответ!"); return; }
        q.correctText = textAns;
    } else if (type === 'flashcard') {
        let flashAns = document.getElementById('new-flashcard-answer').value.trim();
        if (!flashAns) { alert("Добавьте перевод / оборотную сторону!"); return; }
        q.correctText = [flashAns];
    }

    allForms[currentFormId].questions.push(q);
    
    // Очистка полей
    document.getElementById('new-title').value = '';
    document.getElementById('new-options').value = '';
    document.getElementById('new-correct-text').value = '';
    document.getElementById('new-flashcard-answer').value = '';
    document.getElementById('new-hint-text').value = '';
    toggleAddQuestionForm(); // Скрываем форму после добавления

    save();
    renderAdminQuestions();
}

function renderAdminQuestions() {
    const list = document.getElementById('admin-questions-list');
    if (!list) return;

    closePreviewIframe();

    const currentQuestions = allForms[currentFormId].questions || [];
    if (currentQuestions.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">В этой форме пока нет вопросов. Нажмите «Создать вопрос»!</div>`;
        return;
    }

    list.innerHTML = currentQuestions.map((q, i) => `
        <div class="gcard">
            <div class="gcard-header">
                <span class="gcard-num">Вопрос ${i + 1}</span>
                <span class="gcard-badge">${q.type}</span>
            </div>
            <div class="gcard-title">${q.title}</div>
            <div class="gcard-actions">
                <button onclick="previewSingleQuestion(${i})" title="Посмотреть">
                    <span class="material-symbols-rounded">eye_tracking</span>
                </button>
                <button onclick="editQuestion(${i})" title="Изменить заголовок">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="btn-delete" onclick="deleteQuestion(${i})" title="Удалить">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

function editQuestion(i) {
    closePreviewIframe();
    const q = allForms[currentFormId].questions[i];
    let newTitle = prompt("Изменить текст вопроса:", q.title);
    if (newTitle !== null && newTitle.trim() !== "") {
        q.title = newTitle.trim();
        save();
        renderAdminQuestions();
    }
}

function deleteQuestion(i) {
    closePreviewIframe();
    if (!confirm("Удалить этот вопрос?")) return;
    allForms[currentFormId].questions.splice(i, 1);
    save(); 
    renderAdminQuestions(); 
}

// ЭКСПОРТ / ИМПОРТ
function exportFormToJSON() {
    const formToExport = allForms[currentFormId];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formToExport, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `form_${formToExport.name}.json`);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importFormFromJSON(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported && imported.questions) {
                let id = 'imported_' + Date.now();
                allForms[id] = { id: id, name: imported.name + " (Копия)", questions: imported.questions };
                currentFormId = id;
                save();
                renderAdminQuestions();
                alert("Форма успешно загружена!");
            }
        } catch (err) { alert("Ошибка чтения файла. Проверьте формат JSON."); }
        inputElement.value = ''; // Сброс инпута
    };
    reader.readAsText(file);
}

// ПРЕДПРОСМОТР В IFRAME (Временная ссылка)
async function previewSingleQuestion(index) {
    closePreviewIframe();
    const q = allForms[currentFormId].questions[index];
    if (!q) return;

    const expiresAt = Date.now() + 5 * 60 * 1000;
    const jsonStr = JSON.stringify(q);
    
    // Сжимаем данные
    const byteArray = new TextEncoder().encode(jsonStr);
    const stream = new Response(byteArray).body.pipeThrough(new CompressionStream("deflate"));
    const compressedBuffer = await new Response(stream).arrayBuffer();
    
    const base64Str = btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const tempUrl = `${window.location.origin}${window.location.pathname}?preview_q=${base64Str}&expires=${expiresAt}`;

    const modal = document.getElementById('preview-iframe-modal');
    const frame = document.getElementById('preview-iframe');
    
    if (modal && frame) {
        frame.src = tempUrl;
        modal.classList.remove('hidden');

        previewTimer = setTimeout(() => {
            alert("⏰ 5 минут истекло! Временная ссылка предпросмотра сгорела.");
            closePreviewIframe();
        }, 5 * 60 * 1000);
    }
}

function closePreviewIframe() {
    if (previewTimer) clearTimeout(previewTimer);
    const box = document.getElementById('preview-iframe-modal');
    if (box) box.classList.add('hidden');
    const frame = document.getElementById('preview-iframe');
    if (frame) frame.src = 'about:blank';
}

// ПОДЕЛИТЬСЯ (ГЕНЕРАЦИЯ ССЫЛКИ НА ВЕСЬ ТЕСТ)
async function generateShareLink() {
    document.getElementById('tools-menu').classList.add('hidden');
    const form = allForms[currentFormId];
    if (!form || form.questions.length === 0) { alert("Форма пуста!"); return; }
    
    try {
        const jsonStr = JSON.stringify(form);
        const byteArray = new TextEncoder().encode(jsonStr);
        const stream = new Response(byteArray).body.pipeThrough(new CompressionStream("deflate"));
        const compressedBuffer = await new Response(stream).arrayBuffer();
        const base64Str = btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)))
            .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            
        const shareUrl = `${window.location.origin}${window.location.pathname}?zip=${base64Str}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("✅ Ссылка на форму скопирована в буфер обмена!");
        });
    } catch(e) { console.error(e); alert("Ошибка создания ссылки!"); }
}
function handleMediaUpload(event, questionIndex) {
    const file = event.target.files[0];
    if (!file) return;

    // Проверяем размер (например, ограничим до 10 МБ, чтобы не забивать локальное хранилище)
    if (file.size > 10 * 1024 * 1024) {
        alert("Файл слишком большой! Максимальный размер — 10 МБ.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64String = e.target.result;
        
        // Сохраняем в текущий вопрос
        // allForms[currentFormId].questions[questionIndex].media = {
        //     type: file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image',
        //     data: base64String
        // };
        
        save();
        renderAdminQuestions(); // Перерисовываем админку, чтобы показать превью
    };
    reader.readAsDataURL(file);
}
// Пример логики рендеринга вопроса в режиме прохождения
function renderQuestionForUser(q, index) {
    const container = document.getElementById('quiz-question-container');
    if (!container) return;

    // Проверяем, является ли вопрос слайдом-объяснением (теорема / инфо-блок)
    if (q.type === 'info-slide') {
        let mediaHtml = '';
        if (q.media && q.media.data) {
            if (q.media.type === 'image') {
                mediaHtml = `<img src="${q.media.data}" style="width: 100%; max-height: 350px; object-fit: cover; border-radius: var(--radius-mid); margin-bottom: 15px;" alt="Медиа к слайду">`;
            } else if (q.media.type === 'video') {
                mediaHtml = `<video controls style="width: 100%; border-radius: var(--radius-mid); margin-bottom: 15px;"><source src="${q.media.data}"></video>`;
            } else if (q.media.type === 'audio') {
                mediaHtml = `<audio controls style="width: 100%; margin-bottom: 15px;"><source src="${q.media.data}"></audio>`;
            }
        }

        container.innerHTML = `
            <div class="card info-slide-card" style="padding: 25px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius);">
                <div style="display: inline-block; background: rgba(0, 123, 255, 0.1); color: var(--primary); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">Инфо-материал</div>
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: var(--text-main);">${q.title || 'Информация'}</h3>
                ${mediaHtml}
                <div style="font-size: 14px; color: var(--text-muted); line-height: 1.6; margin-bottom: 25px;">${q.text || ''}</div>
                <button onclick="nextStep()" style="width: 100%; padding: 12px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-mid); font-weight: 600; cursor: pointer;">Понятно, продолжить</button>
            </div>
        `;
        return;
    }

    // Здесь дальше идет код для обычных вопросов (выбор, текст и т.д.)
}
