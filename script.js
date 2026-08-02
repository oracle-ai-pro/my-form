// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ, ТЕМЫ, ALERT И НАВИГАЦИЯ
// ==========================================

// Основное хранилище форм
let forms = JSON.parse(localStorage.getItem('quiz_forms')) || [
    {
        id: 'form-1',
        title: 'Тест 1',
        questions: [
            {
                type: 'radio',
                title: 'Какая планета третья от Солнца?',
                options: ['Марс', 'Земля', 'Венера'],
                correctChoices: [1],
                required: true
            }
        ]
    }
];

let currentFormId = localStorage.getItem('active_form_id') || forms[0].id;
let currentQuestionIndex = 0;
let userAnswers = {};
let userHintsUsed = {}; // Фиксирует вопросы, где открывали подсказку
let score = 0;
let timerInterval = null;
let timeLeft = 0;

// Кастомное модальное окно вместо alert()
function alert(msg, icon = 'info') {
    const overlay = document.getElementById('custom-alert');
    const msgEl = document.getElementById('custom-alert-msg');
    const iconEl = document.getElementById('custom-alert-icon');
    if (overlay && msgEl) {
        msgEl.innerText = msg;
        if (iconEl) iconEl.innerText = icon;
        overlay.classList.add('active');
    } else {
        window.alert(msg);
    }
}

function closeAlert() {
    const overlay = document.getElementById('custom-alert');
    if (overlay) overlay.classList.remove('active');
}

// Управление темами оформления
function setTheme(theme) {
    document.body.className = '';
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else if (theme === 'google') {
        document.body.classList.add('google-theme');
    }
    localStorage.setItem('app_theme', theme);
}

function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

// Переключение экранов
function switchScreen(screenName) {
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');

    if (screenName === 'quiz') {
        document.getElementById('quiz-screen').classList.remove('hidden');
    } else if (screenName === 'login') {
        document.getElementById('login-screen').classList.remove('hidden');
    } else if (screenName === 'admin') {
        document.getElementById('admin-screen').classList.remove('hidden');
        renderAdminQuestions();
    }
}

function tryLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    if (u === 'admin' && p === '1234') {
        switchScreen('admin');
    } else {
        alert('Неверный логин или пароль!');
    }
}

function logout() {
    switchScreen('quiz');
}
// ==========================================
// 2. УПРАВЛЕНИЕ ФОРМАМИ И ВКЛАДКАМИ
// ==========================================

function getActiveForm() {
    return forms.find(f => f.id === currentFormId) || forms[0];
}

function saveForms() {
    localStorage.setItem('quiz_forms', JSON.stringify(forms));
    localStorage.setItem('active_form_id', currentFormId);
}

function renderTabs() {
    const listEl = document.getElementById('forms-tabs-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    forms.forEach((form) => {
        const tab = document.createElement('div');
        tab.className = `form-tab ${form.id === currentFormId ? 'active-tab' : ''}`;
        tab.innerHTML = `
            <span onclick="switchForm('${form.id}')">${form.title}</span>
            ${forms.length > 1 ? `
                <button class="tab-action-btn" style="background:none; border:none; color:inherit; cursor:pointer;" onclick="deleteForm('${form.id}', event)">
                    <span class="material-symbols-rounded" style="font-size:16px;">close</span>
                </button>
            ` : ''}
        `;
        listEl.appendChild(tab);
    });
}

function switchForm(id) {
    currentFormId = id;
    currentQuestionIndex = 0;
    userAnswers = {};
    userHintsUsed = {};
    saveForms();
    renderTabs();
    startQuiz();
}

function createNewFormPrompt() {
    const title = prompt('Введите название новой формы:', `Форма ${forms.length + 1}`);
    if (title && title.trim()) {
        const newForm = {
            id: 'form-' + Date.now(),
            title: title.trim(),
            questions: []
        };
        forms.push(newForm);
        switchForm(newForm.id);
    }
}

function deleteForm(id, e) {
    e.stopPropagation();
    if (forms.length <= 1) {
        alert('Нельзя удалить единственную форму!');
        return;
    }
    if (confirm('Вы уверены, что хотите удалить эту форму?')) {
        forms = forms.filter(f => f.id !== id);
        if (currentFormId === id) currentFormId = forms[0].id;
        saveForms();
        renderTabs();
        startQuiz();
    }
}

function generateShareLink() {
    const url = window.location.href.split('?')[0] + '?formId=' + currentFormId;
    navigator.clipboard.writeText(url);
    alert('Ссылка скопирована в буфер обмена!', 'share');
}

function printCurrentForm() {
    window.print();
}
// ==========================================
// 3. ДВИЖОК ТЕСТИРОВАНИЯ И РЕНДЕР
// ==========================================

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = {};
    userHintsUsed = {};
    document.getElementById('quiz-box').classList.remove('hidden');
    document.getElementById('result-box').classList.add('hidden');
    renderQuestion();
}

function toggleHintModal() {
    const hintBox = document.getElementById('hint-box');
    if (hintBox) {
        hintBox.classList.toggle('hidden');
        if (!hintBox.classList.contains('hidden')) {
            userHintsUsed[currentQuestionIndex] = true; // Подсказка использована!
        }
    }
}

function renderQuestion() {
    clearInterval(timerInterval);
    const form = getActiveForm();
    const bodyEl = document.getElementById('question-body');
    const totalEl = document.getElementById('total-number');
    const currentEl = document.getElementById('current-number');
    const progressEl = document.getElementById('progress');
    const timerBox = document.getElementById('timer-display');
    const hintBtn = document.getElementById('hint-btn');
    const hintBox = document.getElementById('hint-box');

    if (!form.questions || form.questions.length === 0) {
        bodyEl.innerHTML = '<p style="text-align:center;">В этой форме пока нет вопросов.</p>';
        totalEl.innerText = '0';
        currentEl.innerText = '0';
        progressEl.style.width = '0%';
        return;
    }

    const q = form.questions[currentQuestionIndex];
    totalEl.innerText = form.questions.length;
    currentEl.innerText = currentQuestionIndex + 1;
    progressEl.style.width = `${((currentQuestionIndex + 1) / form.questions.length) * 100}%`;

    // Настройка таймера
    if (q.timer && q.timer > 0) {
        timeLeft = q.timer;
        document.getElementById('timer-seconds').innerText = timeLeft;
        timerBox.classList.remove('hidden');
        timerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('timer-seconds').innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                nextStep();
            }
        }, 1000);
    } else {
        timerBox.classList.add('hidden');
    }

    // Подсказка
    if (q.hintText) {
        hintBtn.classList.remove('hidden');
        document.getElementById('hint-text').innerText = q.hintText;
    } else {
        hintBtn.classList.add('hidden');
        hintBox.classList.add('hidden');
    }

    let html = `<h3 style="margin-bottom:20px;">${q.title}</h3>`;

    if (q.type === 'radio') {
        q.options.forEach((opt, idx) => {
            html += `
                <label class="option">
                    <input type="radio" name="q_opt" value="${idx}" ${userAnswers[currentQuestionIndex] === idx ? 'checked' : ''}>
                    <span>${opt}</span>
                </label>
            `;
        });
    } else if (q.type === 'checkbox') {
        const selected = userAnswers[currentQuestionIndex] || [];
        q.options.forEach((opt, idx) => {
            html += `
                <label class="option">
                    <input type="checkbox" name="q_opt" value="${idx}" ${selected.includes(idx) ? 'checked' : ''}>
                    <span>${opt}</span>
                </label>
            `;
        });
    } else if (q.type === 'select') {
        html += `<select id="q_select" class="admin-input"><option value="">Выберите ответ...</option>`;
        q.options.forEach((opt, idx) => {
            html += `<option value="${idx}" ${userAnswers[currentQuestionIndex] === idx ? 'selected' : ''}>${opt}</option>`;
        });
        html += `</select>`;
    } else if (q.type === 'text') {
        const val = userAnswers[currentQuestionIndex] || '';
        html += `<input type="text" id="q_text" class="admin-input" placeholder="Введите ваш ответ..." value="${val}">`;
    } else if (q.type === 'puzzle-drag') {
        const currentOrder = userAnswers[currentQuestionIndex] || [...q.options].sort(() => Math.random() - 0.5);
        userAnswers[currentQuestionIndex] = currentOrder;
        html += `<div id="puzzle-list">`;
        currentOrder.forEach((item, idx) => {
            html += `
                <div class="option puzzle-item" draggable="true" data-index="${idx}">
                    <span class="material-symbols-rounded" style="color:var(--text-muted); cursor:grab;">drag_indicator</span>
                    <span class="puzzle-text">${item}</span>
                </div>
            `;
        });
        html += `</div>`;
    } else if (q.type === 'info-slide') {
        if (q.mediaUrl) {
            if (q.mediaType === 'video') {
                html += `<div id="media-preview-container"><video src="${q.mediaUrl}" controls style="width:100%; border-radius:12px;"></video></div>`;
            } else if (q.mediaType === 'audio') {
                html += `<div id="media-preview-container"><audio src="${q.mediaUrl}" controls style="width:100%;"></audio></div>`;
            } else {
                html += `<div id="media-preview-container"><img src="${q.mediaUrl}" style="width:100%; border-radius:12px;" /></div>`;
            }
        }
    } else if (q.type === 'flashcard') {
        html += `
            <div class="flashcard-container" onclick="this.querySelector('.flashcard').classList.toggle('flipped')">
                <div class="flashcard">
                    <div class="flashcard-front">
                        <div class="flashcard-word">${q.title}</div>
                        <span style="font-size:12px; color:var(--text-muted);">Нажмите, чтобы перевернуть</span>
                    </div>
                    <div class="flashcard-back">
                        <div class="flashcard-word">${q.flashcardAnswer || 'Нет перевода'}</div>
                    </div>
                </div>
            </div>
        `;
    } else if (q.type === 'voice_card') {
        html += `
            <div class="voice-card">
                <p>Произнесите ответ голосом:</p>
                <button class="voice-btn" onclick="alert('Голосовой ввод активирован')">
                    <span class="material-symbols-rounded">mic</span> Говорить
                </button>
            </div>
        `;
    }

    bodyEl.innerHTML = html;

    if (q.type === 'puzzle-drag') {
        initDragAndDrop();
    }
}
// ==========================================
// 4. ДРАГ-ЭНД-ДРОП И СОХРАНЕНИЕ ОТВЕТОВ
// ==========================================

function initDragAndDrop() {
    const list = document.getElementById('puzzle-list');
    if (!list) return;
    let dragSrcEl = null;

    const items = list.querySelectorAll('.puzzle-item');
    items.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        });

        item.addEventListener('dragover', function(e) {
            if (e.preventDefault) e.preventDefault();
            return false;
        });

        item.addEventListener('drop', function(e) {
            if (e.stopPropagation) e.stopPropagation();
            if (dragSrcEl !== this) {
                const tempHtml = this.innerHTML;
                this.innerHTML = dragSrcEl.innerHTML;
                dragSrcEl.innerHTML = tempHtml;

                const newOrder = Array.from(list.querySelectorAll('.puzzle-text')).map(el => el.innerText);
                userAnswers[currentQuestionIndex] = newOrder;
            }
            return false;
        });
    });
}

function saveCurrentAnswer() {
    const form = getActiveForm();
    if (!form.questions.length) return;
    const q = form.questions[currentQuestionIndex];

    if (q.type === 'radio') {
        const checked = document.querySelector('input[name="q_opt"]:checked');
        if (checked) userAnswers[currentQuestionIndex] = parseInt(checked.value);
    } else if (q.type === 'checkbox') {
        const checked = Array.from(document.querySelectorAll('input[name="q_opt"]:checked')).map(c => parseInt(c.value));
        userAnswers[currentQuestionIndex] = checked;
    } else if (q.type === 'select') {
        const sel = document.getElementById('q_select');
        if (sel && sel.value !== '') userAnswers[currentQuestionIndex] = parseInt(sel.value);
    } else if (q.type === 'text') {
        const txt = document.getElementById('q_text');
        if (txt) userAnswers[currentQuestionIndex] = txt.value.trim();
    }
}

function nextStep() {
    saveCurrentAnswer();
    const form = getActiveForm();

    if (currentQuestionIndex < form.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        finishQuiz();
    }
}
// ==========================================
// 5. ПОДСЧЕТ И ОТОБРАЖЕНИЕ (4 ЦВЕТА КАРТОЧЕК)
// ==========================================

function finishQuiz() {
    clearInterval(timerInterval);
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');

    const form = getActiveForm();
    score = 0;
    let reviewHtml = '';

    form.questions.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        let isCorrect = false;
        let statusClass = 'incorrect-item';
        let statusText = 'Неверно ❌';
        let statusSpanClass = 'text-danger';

        // 1. Ручная проверка руководителем (Желтый)
        if (q.manualCheck) {
            statusClass = 'yellow-item';
            statusText = 'На проверке у руководителя ⏳';
            statusSpanClass = 'text-warning';
        } 
        // 2. Использована подсказка (Серый)
        else if (userHintsUsed[idx]) {
            statusClass = 'grey-item';
            statusText = 'Использована подсказка 💡';
            statusSpanClass = 'text-hint-used';
        } 
        // 3. Зеленый или Красный
        else {
            if (q.type === 'radio' || q.type === 'select') {
                if (q.correctChoices && q.correctChoices.includes(userAns)) isCorrect = true;
            } else if (q.type === 'checkbox') {
                if (Array.isArray(userAns) && Array.isArray(q.correctChoices)) {
                    const sUser = [...userAns].sort().join(',');
                    const sCorr = [...q.correctChoices].sort().join(',');
                    if (sUser === sCorr) isCorrect = true;
                }
            } else if (q.type === 'text') {
                if (q.correctTextAnswers && q.correctTextAnswers.map(t => t.toLowerCase()).includes((userAns || '').toLowerCase())) {
                    isCorrect = true;
                }
            } else if (q.type === 'puzzle-drag') {
                if (Array.isArray(userAns) && JSON.stringify(userAns) === JSON.stringify(q.options)) {
                    isCorrect = true;
                }
            } else if (q.type === 'info-slide' || q.type === 'flashcard') {
                isCorrect = true;
            }

            if (isCorrect) {
                score++;
                statusClass = 'correct-item';
                statusText = 'Верно ✅';
                statusSpanClass = 'text-success';
            }
        }

        reviewHtml += `
            <div class="review-item ${statusClass}">
                <strong>${idx + 1}. ${q.title}</strong><br/>
                <span class="${statusSpanClass}">
                    ${statusText}
                </span>
            </div>
        `;
    });

    document.getElementById('final-score').innerText = `${score} / ${form.questions.length}`;
    document.getElementById('review-box').innerHTML = reviewHtml;
}

function restartQuiz() {
    startQuiz();
}
// ==========================================
// 6. АДМИНКА - СПИСОК ВОПРОСОВ И КНОПКИ
// ==========================================

function toggleAddQuestionForm() {
    document.getElementById('admin-add-form').classList.toggle('hidden');
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    document.getElementById('admin-choices-fields').classList.toggle('hidden', !['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type));
    document.getElementById('admin-text-fields').classList.toggle('hidden', !['text', 'voice_card'].includes(type));
    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('media-upload-box').classList.toggle('hidden', type !== 'info-slide');
}

function renderAdminQuestions() {
    const form = getActiveForm();
    const listEl = document.getElementById('admin-questions-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    form.questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'gcard';
        card.innerHTML = `
            <div class="gcard-header">
                <span class="gcard-num">#${idx + 1}</span>
                <span class="gcard-badge">${q.type}</span>
            </div>
            <div class="gcard-title">${q.title}</div>
            <div class="gcard-actions" style="display:flex; gap:8px; margin-top:10px;">
                <button onclick="editQuestion(${idx})" class="btn-secondary" style="width:auto; margin:0;">
                    <span class="material-symbols-rounded">edit</span> Изменить
                </button>
                <button onclick="previewQuestionItem(${idx})" class="btn-secondary" style="width:auto; margin:0;">
                    <span class="material-symbols-rounded">visibility</span> Просмотреть
                </button>
                <button class="btn-secondary" style="width:auto; margin:0; color:var(--danger);" onclick="deleteQuestion(${idx})">
                    <span class="material-symbols-rounded">delete</span> Удалить
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

function previewQuestionItem(index) {
    const form = getActiveForm();
    const q = form.questions[index];
    alert(`Предпросмотр вопроса #${index + 1}:\n\nТип: ${q.type}\nТекст: ${q.title}`, 'visibility');
}

function editQuestion(index) {
    const form = getActiveForm();
    const q = form.questions[index];
    
    document.getElementById('new-type').value = q.type;
    toggleAdminFields();
    document.getElementById('new-title').value = q.title;
    
    if (q.options) {
        document.getElementById('new-options').value = q.options.join(', ');
    }
    if (q.correctChoices) {
        document.getElementById('new-correct-choices').value = q.correctChoices.join(', ');
    }
    if (q.correctTextAnswers) {
        document.getElementById('new-correct-text').value = q.correctTextAnswers.join(', ');
    }
    if (q.flashcardAnswer) {
        document.getElementById('new-flashcard-answer').value = q.flashcardAnswer;
    }
    if (document.getElementById('new-manual-check')) {
        document.getElementById('new-manual-check').checked = !!q.manualCheck;
    }

    form.questions.splice(index, 1);
    saveForms();
    renderAdminQuestions();
    
    document.getElementById('admin-add-form').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert('Вопрос загружен в форму редактирования!', 'edit');
}

function deleteQuestion(index) {
    const form = getActiveForm();
    if (confirm('Удалить этот вопрос?')) {
        form.questions.splice(index, 1);
        saveForms();
        renderAdminQuestions();
    }
}
// ==========================================
// 7. СОЗДАНИЕ ВОПРОСА, ИМПОРТ/ЭКСПОРТ И СТАРТ
// ==========================================

let tempMediaUrl = '';
let tempMediaType = 'image';

function handleMediaUploadPreview(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        tempMediaUrl = e.target.result;
        if (file.type.startsWith('video/')) tempMediaType = 'video';
        else if (file.type.startsWith('audio/')) tempMediaType = 'audio';
        else tempMediaType = 'image';

        const container = document.getElementById('media-preview-container');
        if (container) {
            if (tempMediaType === 'video') {
                container.innerHTML = `<video src="${tempMediaUrl}" controls style="max-width:100%; height:150px;"></video>`;
            } else if (tempMediaType === 'audio') {
                container.innerHTML = `<audio src="${tempMediaUrl}" controls></audio>`;
            } else {
                container.innerHTML = `<img src="${tempMediaUrl}" style="max-width:100%; height:150px;" />`;
            }
        }
    };
    reader.readAsDataURL(file);
}

function addQuestion() {
    const title = document.getElementById('new-title').value.trim();
    const type = document.getElementById('new-type').value;

    if (!title) {
        alert('Введите текст вопроса!');
        return;
    }

    const form = getActiveForm();
    const q = {
        type: type,
        title: title,
        required: document.getElementById('new-required').checked,
        manualCheck: document.getElementById('new-manual-check') ? document.getElementById('new-manual-check').checked : false
    };

    if (['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type)) {
        const rawOpts = document.getElementById('new-options').value;
        q.options = rawOpts.split(',').map(s => s.trim()).filter(Boolean);
        const rawCorr = document.getElementById('new-correct-choices').value;
        q.correctChoices = rawCorr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    } else if (['text', 'voice_card'].includes(type)) {
        const rawCorrText = document.getElementById('new-correct-text').value;
        q.correctTextAnswers = rawCorrText.split(',').map(s => s.trim()).filter(Boolean);
    } else if (type === 'flashcard') {
        q.flashcardAnswer = document.getElementById('new-flashcard-answer').value.trim();
    } else if (type === 'info-slide') {
        q.mediaUrl = tempMediaUrl;
        q.mediaType = tempMediaType;
    }

    if (document.getElementById('toggle-timer-input').checked) {
        q.timer = parseInt(document.getElementById('new-timer').value) || 20;
    }

    if (document.getElementById('toggle-hint-input').checked) {
        q.hintText = document.getElementById('new-hint-text').value.trim();
    }

    form.questions.push(q);
    saveForms();
    renderAdminQuestions();
    toggleAddQuestionForm();
    alert('Вопрос успешно сохранён!', 'check_circle');
}

function exportFormToJSON() {
    const form = getActiveForm();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(form, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${form.title}.json`);
    dlAnchorElem.click();
}

function importFormFromJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported && imported.title && Array.isArray(imported.questions)) {
                imported.id = 'form-' + Date.now();
                forms.push(imported);
                switchForm(imported.id);
                alert('Форма импортирована!', 'check_circle');
            } else {
                alert('Неверный формат JSON.');
            }
        } catch (err) {
            alert('Ошибка чтения файла.');
        }
    };
    reader.readAsText(file);
}

// Старт приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('app_theme') || 'light';
    setTheme(savedTheme);

    const urlParams = new URLSearchParams(window.location.search);
    const linkFormId = urlParams.get('formId');
    if (linkFormId && forms.some(f => f.id === linkFormId)) {
        currentFormId = linkFormId;
    }

    renderTabs();
    startQuiz();
});
