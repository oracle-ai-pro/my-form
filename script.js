// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И МУЛЬТИФОРМЫ
// ==========================================
let allForms = JSON.parse(localStorage.getItem('q_forms')) || {"def": {id: "def", name: "Главная форма", questions: []}};
let currentFormId = localStorage.getItem('q_curr_id') || "def";
if (!allForms[currentFormId]) currentFormId = Object.keys(allForms)[0] || "def";

let questions = allForms[currentFormId].questions;
let currentIndex = 0, userAnswers = [], currentTimerInterval = null, timeLeft = 0, isExplanationState = false, currentVoiceAnswer = null;

const save = () => {
    localStorage.setItem('q_forms', JSON.stringify(allForms));
    localStorage.setItem('q_curr_id', currentFormId);
    questions = allForms[currentFormId].questions;
    renderTabs();
};

window.onload = async () => { 
    const urlParams = new URLSearchParams(window.location.search);
    const zipData = urlParams.get('zip');
    
    if (zipData) {
        try {
            // Восстанавливаем стандартный Base64 из URL-безопасного вида
            let base64 = zipData.replace(/-/g, "+").replace(/_/g, "/");
            while (base64.length % 4) base64 += "=";
            
            // Переводим строку в двоичные байты
            const binaryStr = atob(base64);
            const byteArray = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                byteArray[i] = binaryStr.charCodeAt(i);
            }
            
            // Распаковываем данные алгоритмом Deflate обратно в текст
            const stream = new Response(byteArray).body.pipeThrough(new DecompressionStream("deflate"));
            const jsonStr = await new Response(stream).text();
            const importedForm = JSON.parse(jsonStr);
            
            if (importedForm.questions && importedForm.questions.length > 0) {
                const sharedId = 'shared_' + Date.now();
                
                allForms[sharedId] = {
                    id: sharedId,
                    name: `⭐ ${importedForm.name || "Общая форма"}`,
                    questions: importedForm.questions
                };
                
                currentFormId = sharedId;
                
                const leaveBtn = document.getElementById('leave-shared-btn');
                if (leaveBtn) {
                    leaveBtn.classList.remove('hidden');
                    leaveBtn.href = window.location.origin + window.location.pathname;
                }
            }
        } catch (err) {
            console.error(err);
            alert("Не удалось открыть форму. Ссылка повреждена или некорректна.");
        }
    }

    // Загрузка темы и запуск
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
    if (!confirm(`Удалить форму "${allForms[id].name}" и все её вопросы?`)) return;
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
                <h3>У вас нет форм 🤷‍♂️</h3><p style="color:var(--text-muted);">Создайте их через админку.</p>
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
        if (q.required && answers.length === 0 && rawValue === "" && q.type !== 'voice_card') { alert("Этот вопрос обязателен!"); return; }
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
        title: q.title, 
        userAns: rawValue, 
        finalStatus: finalStatus, 
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
        let itemClass = "incorrect-item", textClass = "text-danger", displayAns = a.userAns || '[Пусто]';
        if (a.finalStatus === "correct") { itemClass = "correct-item"; textClass = "text-success"; }
        else if (a.finalStatus === "skipped") { itemClass = "skipped-item"; textClass = "text-skipped"; }
        return `
            <div class="review-item ${itemClass}">
                <strong>${a.title}</strong><br>
                Ваш ответ: <span class="${textClass}">${displayAns}</span><br>
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
// 3. УПРАВЛЕНИЕ МИКРОФОНОМ И ТАПОМ ПО КАРТЕ
// ==========================================
function handleVoiceCardFail(reason = "Подсмотрел(-а)") {
    const status = document.getElementById('voice-status');
    const q = questions[currentIndex];
    const firstCorrectAnswer = q.correctText ? q.correctText[0] : ''; // Берем первый синоним
    const correctAnswersText = q.correctText ? q.correctText.join(' / ') : '';
    
    if (status) status.innerHTML = `⚠️ <strong>${reason}:</strong> За картой было слово: "${correctAnswersText}"`;
    
    // Автоматически проговариваем правильное слово!
    if (firstCorrectAnswer) speakText(firstCorrectAnswer);
    
    currentVoiceAnswer = { text: `[${reason}]`, status: "skipped" };
    const card = document.querySelector('.voice-card');
    if (card) card.style.borderColor = 'var(--gray)';
    
    setTimeout(() => nextStep(), 1800); // Чуть увеличили таймер, чтобы успело договорить
}


function startVoiceRecognition(event, correctAnswersStr) {
    event.stopPropagation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Ваш браузер не поддерживает распознавание речи. Используйте Google Chrome."); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU'; recognition.interimResults = false;
    const btn = document.getElementById('mic-btn'), status = document.getElementById('voice-status'), card = document.querySelector('.voice-card');
    
    if (btn) { btn.classList.add('recording'); btn.innerText = "Слушаю..."; }
    if (status) status.innerText = "Говорите слово...";
    recognition.start();

    recognition.onresult = function(e) {
        const userSpeech = e.results[0][0].transcript.trim();
        if (status) status.innerText = `Вы сказали: "${userSpeech}"`;
        
        const allowed = correctAnswersStr.split(',').map(item => item.trim().toLowerCase());
        
        if (allowed.includes(userSpeech.toLowerCase())) {
            if (status) status.innerHTML = `🎉 <strong>Правильно!</strong> Вы сказали: "${userSpeech}"`;
            if (card) card.style.borderColor = 'var(--success)';
            currentVoiceAnswer = { text: userSpeech, status: "correct" };
        } else {
            if (status) status.innerHTML = `❌ <strong>Неверно.</strong> Вы сказали: "${userSpeech}".<br><small>Ожидалось: ${correctAnswersStr}</small>`;
            if (card) card.style.borderColor = 'var(--danger)';
            currentVoiceAnswer = { text: userSpeech, status: "incorrect" };
        }
    };

    recognition.onerror = () => { 
        if (status) status.innerText = "Ошибка работы микрофона."; 
        resetMic(btn); 
    };
    
    recognition.onend = () => resetMic(btn);
}
function restartQuiz() {
    currentIndex = 0; 
    userAnswers = [];
    document.getElementById('result-box').classList.add('hidden');
    document.getElementById('quiz-box').classList.remove('hidden');
    renderQuestion();
}

const resetMic = btn => { 
    if (btn) { 
        btn.classList.remove('recording'); 
        btn.innerHTML = '<span class="material-symbols-rounded">mic</span> Нажать и сказать'; 
    } 
};

// ==========================================
// 4. ОПЦИИ И ИНТЕРФЕЙС (ТЕМЫ И МЕНЮ)
// ==========================================
document.addEventListener('click', e => {
    const m = document.getElementById('tools-menu');
    const b = document.querySelector('.tools-btn');
    if (m && !m.classList.contains('hidden') && e.target !== m && e.target !== b && !b?.contains(e.target)) {
        m.classList.add('hidden');
    }
});

function setTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-theme'); 
    else document.body.classList.remove('dark-theme');
    localStorage.setItem('quiz_theme', theme);
}

function switchScreen(screen) {
    document.getElementById('quiz-screen').classList.toggle('hidden', screen !== 'quiz');
    document.getElementById('login-screen').classList.toggle('hidden', screen !== 'login');
    document.getElementById('admin-screen').classList.toggle('hidden', screen !== 'admin');
    if (screen === 'admin') renderAdminQuestions();
}

function tryLogin() {
    if (document.getElementById('login-user').value === 'admin' && document.getElementById('login-pass').value === '1234') {
        switchScreen('admin');
    } else { 
        alert("Неверный логин или пароль!"); 
    }
}

function logout() { switchScreen('quiz'); }
// ==========================================
// 5. ПАНЕЛЬ АДМИНИСТРАТОРА И ЭКСПОРТ
// ==========================================
function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    document.getElementById('admin-choices-fields').classList.toggle('hidden', type === 'text' || type === 'voice_card');
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text' && type !== 'voice_card');
    
    const textLabel = document.getElementById('admin-text-fields')?.querySelector('label');
    if (textLabel) {
        if (type === 'voice_card') {
            textLabel.innerHTML = '🎤 Произносимое слово (можно через запятую для синонимов):';
            document.getElementById('new-correct-text').placeholder = 'привет, hello, хай';
        } else {
            textLabel.innerHTML = 'Правильный текст (через запятую для синонимов):';
            document.getElementById('new-correct-text').placeholder = 'ответ1, ответ2';
        }
    }
}

function addQuestion() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();
    const required = document.getElementById('new-required').checked;
    const useTimer = document.getElementById('toggle-timer-input').checked;
    const timer = parseInt(document.getElementById('new-timer').value) || 20;
    const useExp = document.getElementById('toggle-exp-input').checked;
    const expTitle = document.getElementById('new-exp-title').value.trim();
    const expDesc = document.getElementById('new-exp-desc').value.trim();
    const expHold = parseInt(document.getElementById('new-exp-timer').value) || 0;

    if (!title) { alert("Введите текст вопроса!"); return; }
    let q = { type, title, required, useTimer, timer };
    if (useExp && expDesc) q.exp = { title: expTitle, desc: expDesc, hold: expHold };

    if (type === 'text' || type === 'voice_card') {
        const txt = document.getElementById('new-correct-text').value;
        if (!txt) { alert("Укажите правильный ответ!"); return; }
        q.correctText = txt.split(',').map(s => s.trim());
    } else {
        const opts = document.getElementById('new-options').value;
        const codes = document.getElementById('new-correct-choices').value;
        if (!opts || !codes) { alert("Заполните варианты и индексы!"); return; }
        q.options = opts.split(',').map(s => s.trim()); 
        q.correct = codes.split(',').map(s => parseInt(s.trim()));
    }

    allForms[currentFormId].questions.push(q);
    save(); 
    renderAdminQuestions(); 
    alert("Вопрос сохранен в текущую форму!");
}

function renderAdminQuestions() {
    const list = document.getElementById('admin-questions-list');
    if (!list) return;
    
    list.innerHTML = (allForms[currentFormId].questions || []).map((q, i) => `
        <div class="question-list-item" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <span style="flex-grow:1;">${i + 1}. ${q.title} <strong>(${q.type})</strong></span>
            <div style="display:flex; gap:5px;">
                <button class="btn-secondary" onclick="editQuestion(${i})" style="margin:0; padding:6px 10px; font-size:12px; width:auto;"><span class="material-symbols-rounded" style="font-size:14px;">edit</span> Изменить</button>
                <button class="btn-danger" onclick="deleteQuestion(${i})" style="margin:0; padding:6px 10px; font-size:12px; width:auto;"><span class="material-symbols-rounded" style="font-size:14px;">delete</span></button>
            </div>
        </div>
    `).join('');
}

function editQuestion(i) {
    const q = allForms[currentFormId].questions[i];
    
    document.getElementById('new-type').value = q.type;
    document.getElementById('new-title').value = q.title;
    document.getElementById('new-required').checked = q.required || false;
    document.getElementById('toggle-timer-input').checked = q.useTimer || false;
    document.getElementById('new-timer').value = q.timer || 20;
    
    document.getElementById('timer-val-box').classList.toggle('hidden', !q.useTimer);

    if (q.exp) {
        document.getElementById('toggle-exp-input').checked = true;
        document.getElementById('exp-fields-box').classList.remove('hidden');
        document.getElementById('new-exp-title').value = q.exp.title || '';
        document.getElementById('new-exp-desc').value = q.exp.desc || '';
        document.getElementById('new-exp-timer').value = q.exp.hold || 0;
    } else {
        document.getElementById('toggle-exp-input').checked = false;
        document.getElementById('exp-fields-box').classList.add('hidden');
    }

    if (q.type === 'text' || q.type === 'voice_card') {
        document.getElementById('new-correct-text').value = q.correctText ? q.correctText.join(', ') : '';
    } else {
        document.getElementById('new-options').value = q.options ? q.options.join(', ') : '';
        document.getElementById('new-correct-choices').value = q.correct ? q.correct.join(', ') : '';
    }

    toggleAdminFields();
    allForms[currentFormId].questions.splice(i, 1);
    save();
    renderAdminQuestions();
    
    document.querySelector('.admin-box').scrollTop = 0;
}
function deleteQuestion(i) {
    allForms[currentFormId].questions.splice(i, 1);
    save(); // Сохраняем изменения в localStorage
    renderAdminQuestions(); // Обновляем список на экране
}


function exportFormToJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allForms[currentFormId]));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${allForms[currentFormId].name}.json`);
    dlAnchorElem.click();
}

function importFormFromJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.id || !imported.questions) { alert("Неверный формат файла формы!"); return; }
            const newId = 'f_' + Date.now();
            allForms[newId] = { id: newId, name: imported.name || "Импортированная форма", questions: imported.questions };
            currentFormId = newId; 
            currentIndex = 0; 
            userAnswers = []; 
            save(); 
            renderQuestion();
            alert("Форма успешно загружена!");
            switchScreen('quiz');
        } catch (err) { 
            alert("Ошибка при чтении файла!"); 
        }
    };
    reader.readAsText(file);
}

// ==========================================
// 5.5 ОПЦИИ МЕНЮ И ФИЧА "BLACK SCREEN"
// ==========================================
function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('tools-menu');
    const btn = document.querySelector('.tools-btn');
    if (menu && !menu.classList.contains('hidden') && e.target !== menu && e.target !== btn && !btn?.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

function toggleBlackScreen() {
    let overlay = document.getElementById('black-screen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'black-screen-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = '#000000';
        overlay.style.zIndex = '99999';
        overlay.style.cursor = 'pointer';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.color = '#333';
        overlay.style.fontFamily = 'monospace';
        overlay.style.fontSize = '12px';
        overlay.innerHTML = '<span>A/V MUTE (Tap or CTRL+M to exit)</span>';
        
        overlay.onclick = () => overlay.classList.add('hidden');
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.add('hidden');
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const overlay = document.getElementById('black-screen-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        } else {
            toggleBlackScreen();
        }
    }
});

async function generateShareLink() {
    try {
        const currentForm = allForms[currentFormId];
        if (!currentForm || !currentForm.questions || currentForm.questions.length === 0) {
            alert("Нельзя поделиться пустой формой! Сначала добавьте вопросы.");
            return;
        }
        const jsonStr = JSON.stringify(currentForm);
        const byteArray = new TextEncoder().encode(jsonStr);
        const stream = new Response(byteArray).body.pipeThrough(new CompressionStream("deflate"));
        const compressedBuffer = await new Response(stream).arrayBuffer();
        const base64Str = btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)))
            .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            
        const shareUrl = `${window.location.origin}${window.location.pathname}?zip=${base64Str}`;
        await navigator.clipboard.writeText(shareUrl);
        alert(`Форма "${currentForm.name}" сжата и скопирована в буфер обмена! Ссылка теперь короткая и откроется везде.`);
    } catch (e) {
        console.error(e);
        alert("Ошибка сжатия. Используйте скачивание .json файла!");
    }
}
// Функция озвучки текста голосом
function speakText(text) {
    if (!('speechSynthesis' in window)) {
        alert("Ваш браузер не поддерживает озвучку текста.");
        return;
    }
    // Останавливаем прошлую озвучку, если она еще говорит
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Автоматически определяем язык: если есть английские буквы — читаем по-английски
    utterance.lang = /[a-zA-Z]/.test(text) ? 'en-US' : 'ru-RU';
    utterance.rate = 1.0; // Скорость речи
    
    window.speechSynthesis.speak(utterance);
}
function closeDeutschPopup() {
    const popup = document.getElementById('deutsch-popup');
    if (popup) {
        popup.classList.add('hidden');
        // Опционально: можно сохранить в localStorage, чтобы баннер не всплывал повторно при закрытии
        localStorage.setItem('deutsch_popup_closed', 'true');
    }
}
function checkAdminAccessForCurrentTopic() {
    const currentUser = JSON.parse(localStorage.getItem('lang_current_user'));
    const currentTopicId = localStorage.getItem('q_curr_id');
    
    // Находим родительский блок с ссылкой "Войти в Редактор"
    const footerLink = document.getElementById('footer-link'); 

    if (!footerLink) return;

    // Скрываем для обычных учеников или если не авторизован
    if (!currentUser || currentUser.type !== 'org') {
        footerLink.style.display = 'none';
        return;
    }

    // Проверяем тумблер у задания
    const publishedTopics = JSON.parse(localStorage.getItem('lang_published_topics')) || [];
    const currentTopic = publishedTopics.find(t => t.id === currentTopicId);

    if (currentTopic && currentTopic.allowAdmin === false) {
        footerLink.style.display = 'none'; // Скрываем ссылку
    } else {
        footerLink.style.display = 'block'; // Показываем
    }
}

window.addEventListener('DOMContentLoaded', checkAdminAccessForCurrentTopic);
// Проверка при загрузке страницы: если пользователь уже закрывал, не показываем
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('deutsch_popup_closed') === 'true') {
        const popup = document.getElementById('deutsch-popup');
        if (popup) popup.classList.add('hidden');
    }
});
document.addEventListener('keydown', (e) => {
    // Работаем только если открыта карточка слова
    const activeCard = document.querySelector('.flashcard-container');
    if (!activeCard) return;

    if (e.code === 'Space') {
        e.preventDefault();
        flipCard(); // Перевернуть / открыть ответ
    } else if (e.code === 'ArrowRight') {
        knowWord(true); // "Я знал это"
    } else if (e.code === 'ArrowLeft') {
        knowWord(false); // "Записать в словарь"
    }
});
function speakWord(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE'; // Или 'en-US' в зависимости от курса
    window.speechSynthesis.speak(utterance);
}
