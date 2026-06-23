// 1. ИНИЦИАЛИЗАЦИЯ И МУЛЬТИФОРМЫ
let allForms = JSON.parse(localStorage.getItem('q_forms')) || {"def": {id: "def", name: "Главная форма", questions: []}};
let currentFormId = localStorage.getItem('q_curr_id') || "def";
if (!allForms[currentFormId]) currentFormId = Object.keys(allForms)[0] || "def";

let questions = allForms[currentFormId].questions, currentIndex = 0, userAnswers = [], currentTimerInterval = null, timeLeft = 0, isExplanationState = false, currentVoiceAnswer = null;

const save = () => {
    localStorage.setItem('q_forms', JSON.stringify(allForms));
    localStorage.setItem('q_curr_id', currentFormId);
    questions = allForms[currentFormId].questions;
    renderTabs();
};

window.onload = () => { save(); renderQuestion(); };

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

const switchForm = id => { if(currentFormId !== id) { currentFormId = id; currentIndex = 0; userAnswers = []; save(); renderQuestion(); }};

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

// 2. ДВИЖОК ТЕСТИРОВАНИЯ
function renderQuestion() {
    clearInterval(currentTimerInterval);
    isExplanationState = currentVoiceAnswer = null;
    const nextBtn = document.getElementById('next-btn');
    nextBtn.innerText = "Далее"; nextBtn.disabled = false; nextBtn.classList.remove('hidden');

    if (!questions?.length) {
        document.getElementById('question-body').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <h3>У вас нет форм 🤷‍♂️</h3><p style="color:var(--text-muted);">Создайте их через админку.</p>
                <button onclick="switchScreen('login')" style="width:auto; display:inline-block; padding:10px 20px;">Перейти в админку</button>
            </div>`;
        nextBtn.classList.add('hidden');
        document.getElementById('current-number').innerText = document.getElementById('total-number').innerText = "0";
        return;
    }

    const q = questions[currentIndex];
    document.getElementById('current-number').innerText = currentIndex + 1;
    document.getElementById('total-number').innerText = questions.length;
    document.getElementById('progress').style.width = `${(currentIndex / questions.length) * 100}%`;

    let html = `<h3>${q.title} ${q.required ? '<span style="color:red">*</span>' : ''}</h3>`;
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
                <button class="voice-btn" id="mic-btn" onclick="startVoiceRecognition(event, '${q.correctText?.join(',') || ''}')">
                    <span class="material-symbols-rounded">mic</span> Нажать и сказать
                </button>
                <div class="voice-status" id="voice-status">Скажите ответ или нажмите на карточку, если не знаете его.</div>
            </div>`;
    }
    document.getElementById('question-body').innerHTML = html + `<div id="explanation-container" class="hidden" style="margin-top:15px; padding:15px; border-radius:12px; background:#fff3cd; color:#333;"></div>`;

    if (q.useTimer && q.timer > 0) {
        let tDisplay = document.getElementById('timer-display'); tDisplay.classList.remove('hidden');
        timeLeft = q.timer; document.getElementById('timer-seconds').innerText = timeLeft;
        currentTimerInterval = setInterval(() => {
            timeLeft--; document.getElementById('timer-seconds').innerText = timeLeft;
            if (timeLeft <= 0) { clearInterval(currentTimerInterval); nextStep(true); }
        }, 1000);
    } else { document.getElementById('timer-display').classList.add('hidden'); }
}
