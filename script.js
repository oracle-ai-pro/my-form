// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И МУЛЬТИФОРМЫ
// ==========================================
let allForms = JSON.parse(localStorage.getItem('q_forms')) || {"def": {id: "def", name: "Главная форма", questions: []}};
let currentFormId = localStorage.getItem('q_curr_id') || "def";
if (!allForms[currentFormId]) currentFormId = Object.keys(allForms)[0] || "def";

let questions = allForms[currentFormId].questions;
let currentIndex = 0, userAnswers = [], currentTimerInterval = null, timeLeft = 0, isExplanationState = false, currentVoiceAnswer = null;
let previewTimer = null; // Таймер для iframe

const save = () => {
    localStorage.setItem('q_forms', JSON.stringify(allForms));
    localStorage.setItem('q_curr_id', currentFormId);
    questions = allForms[currentFormId].questions;
    renderTabs();
};

window.onload = async () => { 
    const urlParams = new URLSearchParams(window.location.search);
    
    // ПРЕДПРОСМОРТ ОДНОГО ВОПРОСА В IFRAME
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

            // Инициализируем демо-режим для 1 вопроса
            allForms = { "preview": { id: "preview", name: "Предпросмотр", questions: [singleQuestion] } };
            currentFormId = "preview";
            questions = [singleQuestion];
            
            // Автоматическое уничтожение через оставшееся время
            setTimeout(() => { window.location.reload(); }, expiresAt - Date.now());
        } catch (e) {
            document.body.innerHTML = `<h3 style="color:red; text-align:center; padding-top:50px;">Ошибка загрузки предпросмотра</h3>`;
            return;
        }
    } else {
        // Обычный импорт по ZIP-ссылке
        const zipData = urlParams.get('zip');
        if (zipData) {
            try {
                let base64 = zipData.replace(/-/g, "+").replace(/_/g, "/");
                while (base64.length % 4) base64 += "=";
                const binaryStr = atob(base64);
                const byteArray = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) byteArray[i] = binaryStr.charCodeAt(i);
                
                const stream = new Response(byteArray).body.pipeThrough(new DecompressionStream("deflate"));
                const jsonStr = await new Response(stream).text();
                const importedForm = JSON.parse(jsonStr);
                
                if (importedForm.questions && importedForm.questions.length > 0) {
                    const sharedId = 'shared_' + Date.now();
                    allForms[sharedId] = { id: sharedId, name: `⭐ ${importedForm.name || "Общая форма"}`, questions: importedForm.questions };
                    currentFormId = sharedId;
                }
            } catch (err) { console.error(err); }
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
            <button class="close-tab-btn" onclick="deleteForm(event, '${id}')"><span class="material-symbols-rounded">close</span></button>
        </div>
    `).join('');
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
    isExplanationState = currentVoiceAnswer = null;
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) { nextBtn.innerText = "Далее"; nextBtn.disabled = false; nextBtn.classList.remove('hidden'); }

    if (!questions?.length) {
        document.getElementById('question-body').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <h3>В этой форме нет вопросов 🤷‍♂️</h3><p style="color:var(--text-muted);">Создайте их через админку.</p>
                <button onclick="switchScreen('login')" style="width:auto; display:inline-block; padding:10px 20px;">Перейти в админку</button>
            </div>`;
        if (nextBtn) nextBtn.classList.add('hidden');
        document.getElementById('current-number').innerText = document.getElementById('total-number').innerText = "0";
        return;
    }
    
    const q = questions[currentIndex];
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;
    document.getElementById('progress').style.width = `${(currentIndex / questions.length) * 100}%`;

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
        html += `<select id="quiz_select"><option value="">-- Выберите ответ --</option>` + q.options.map((opt, i) => `<option value="${i}">${opt}</option>`).join('') + `</select>`;
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

    document.getElementById('question-body').innerHTML = html + `<div id="explanation-container" class="hidden" style="margin-top:15px; padding:15px; border-radius:12px; background:#fff3cd; color:#333;"></div>`;

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

        if (q.required && answers.length === 0 && rawValue === "" && q.type !== 'voice_card') { 
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
    } else {
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
// 3. УПРАВЛЕНИЕ МИКРОФОНОМ И ГОЛОСОМ
// ==========================================
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

// ==========================================
// 4. ОПЦИИ И ИНТЕРФЕЙС
// ==========================================
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
        renderAdminQuestions();
    }
}

function tryLogin() {
    if (document.getElementById('login-user').value === 'admin' && document.getElementById('login-pass').value === '1234') {
        switchScreen('admin');
    } else { alert("Неверный логин или пароль!"); }
}

function logout() { switchScreen('quiz'); }

// ==========================================
// 5. ЛЁГКАЯ АДМИНКА (GOOGLE FORMS STYLE) + IFRAME
// ==========================================
function closePreviewIframe() {
    if (previewTimer) clearTimeout(previewTimer);
    const box = document.getElementById('iframe-preview-modal');
    if (box) box.classList.add('hidden');
    const frame = document.getElementById('preview-iframe');
    if (frame) frame.src = '';
}

async function previewSingleQuestion(index) {
    // Закрываем предыдущий предпросмотр, если открыт
    closePreviewIframe();

    const q = allForms[currentFormId].questions[index];
    if (!q) return;

    // 1. Создаем сжатую временную ссылку (живет 5 минут)
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const jsonStr = JSON.stringify(q);
    const byteArray = new TextEncoder().encode(jsonStr);
    const stream = new Response(byteArray).body.pipeThrough(new CompressionStream("deflate"));
    const compressedBuffer = await new Response(stream).arrayBuffer();
    const base64Str = btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const tempUrl = `${window.location.origin}${window.location.pathname}?preview_q=${base64Str}&expires=${expiresAt}`;

    // 2. Показываем Modal с iframe
    const modal = document.getElementById('iframe-preview-modal');
    const frame = document.getElementById('preview-iframe');
    
    if (modal && frame) {
        frame.src = tempUrl;
        modal.classList.remove('hidden');

        // 3. Авто-закрытие и сгорание ссылки ровно через 5 минут
        previewTimer = setTimeout(() => {
            alert("⏰ 5 минут истекло! Временная ссылка предпросмотра сгорела.");
            closePreviewIframe();
        }, 5 * 60 * 1000);
    }
}

function renderAdminQuestions() {
    const list = document.getElementById('admin-questions-list');
    if (!list) return;

    // При переключении или клике на любой вопрос — уничтожаем активный iframe предпросмотра!
    closePreviewIframe();

    const currentQuestions = allForms[currentFormId].questions || [];

    if (currentQuestions.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">В этой форме пока нет вопросов. Нажмите кнопку ниже, чтобы создать!</div>`;
        return;
    }

    // Легкие карточки как в Google Формах
    list.innerHTML = currentQuestions.map((q, i) => `
        <div class="gcard" onclick="closePreviewIframe()">
            <div class="gcard-header">
                <span class="gcard-num">Вопрос ${i + 1}</span>
                <span class="gcard-badge">${q.type}</span>
            </div>
            <div class="gcard-title">${q.title}</div>
            <div class="gcard-actions">
                <button class="btn-secondary" onclick="previewSingleQuestion(${i})">
                    <span class="material-symbols-rounded">visibility</span> Просмотреть вопрос
                </button>
                <button class="btn-secondary" onclick="editQuestion(${i})">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="btn-danger" onclick="deleteQuestion(${i})">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

function addNewQuestionQuick() {
    const title = prompt("Введите текст вопроса:");
    if (!title?.trim()) return;

    const type = prompt("Выберите тип (radio, checkbox, text, flashcard, voice_card):", "radio");
    if (!type) return;

    let q = { type, title: title.trim(), required: false };

    if (type === 'text' || type === 'voice_card' || type === 'flashcard') {
        let ans = prompt("Введите правильный ответ (или варианты через запятую):");
        q.correctText = ans ? ans.split(',').map(s => s.trim()) : [""];
    } else {
        let opts = prompt("Введите варианты ответов через запятую:", "Вариант 1, Вариант 2");
        let correctIdx = prompt("Индекс правильного ответа (начиная с 0):", "0");
        q.options = opts ? opts.split(',').map(s => s.trim()) : ["Да", "Нет"];
        q.correct = [parseInt(correctIdx) || 0];
    }

    allForms[currentFormId].questions.push(q);
    save();
    renderAdminQuestions();
}

function editQuestion(i) {
    closePreviewIframe();
    const q = allForms[currentFormId].questions[i];
    let newTitle = prompt("Изменить текст вопроса:", q.title);
    if (newTitle !== null) {
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

// ==========================================
// 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ОЗВУЧКА
// ==========================================
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        const card = document.getElementById('main-flashcard');
        if (card && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault(); flipCard();
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const overlay = document.getElementById('black-screen-overlay');
        if (overlay && !overlay.classList.contains('hidden')) overlay.classList.add('hidden');
        else toggleBlackScreen();
    }
});

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[a-zA-Z]/.test(text) ? 'en-US' : 'ru-RU';
    window.speechSynthesis.speak(utterance);
}

window.addEventListener('DOMContentLoaded', () => {
    const footerLink = document.getElementById('footer-link'); 
    if (footerLink) footerLink.style.display = 'block';
});
