/* ==========================================
   1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЯ
   ========================================== */
let allForms = [];
let currentFormIndex = 0;
let currentQuestionIndex = 0;
let userAnswers = {};
let timerInterval = null;
let currentTimerSeconds = 0;
let uploadedMediaBase64 = null;

// Стандартная демонстрационная форма по умолчанию
const defaultForm = {
    title: "Тестовая форма",
    questions: [
        {
            type: "radio",
            title: "Какой язык используется для стилизации веб-страниц?",
            options: ["HTML", "CSS", "JavaScript", "Python"],
            correctChoices: [1],
            required: true
        },
        {
            type: "flashcard",
            title: "JavaScript (JS)",
            flashcardAnswer: "Мультипарадигменный язык программирования, используемый для создания интерактивности на веб-страницах."
        },
        {
            type: "puzzle-drag",
            title: "Расставьте слова по порядку (Цифры 1, 2, 3):",
            options: ["Второй", "Первый", "Третий"],
            correctChoices: [1, 0, 2] // Порядок правильных ответов
        }
    ]
};

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadFormsFromStorage();
    initSettings();
    renderAllFormsUI();
    loadCurrentForm();
});

/* ==========================================
   2. УПРАВЛЕНИЕ ХРАНИЛИЩЕМ (LOCALSTORAGE)
   ========================================== */
function loadFormsFromStorage() {
    const saved = localStorage.getItem('my_forms_data');
    if (saved) {
        try {
            allForms = JSON.parse(saved);
        } catch (e) {
            console.error("Ошибка чтения из localStorage", e);
            allForms = [defaultForm];
        }
    } else {
        allForms = [defaultForm];
        saveFormsToStorage();
    }
}

function saveFormsToStorage() {
    localStorage.setItem('my_forms_data', JSON.stringify(allForms));
}

/* ==========================================
   3. НАСТРОЙКИ И ИНТЕРФЕЙС (SETTINGS & THEME)
   ========================================== */
function initSettings() {
    // Восстановление темы
    const savedTheme = localStorage.getItem('app_theme') || 'light';
    setTheme(savedTheme, false);

    // Восстановление компактного вида
    const isCompact = localStorage.getItem('compact_forms_mode') === 'true';
    const toggleInput = document.getElementById('toggle-compact-forms');
    if (toggleInput) toggleInput.checked = isCompact;
    applyFormsLayout(isCompact);
}

function setTheme(themeName, save = true) {
    if (themeName === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    if (save) localStorage.setItem('app_theme', themeName);
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('active');
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
}

function toggleFormsLayout(isCompact) {
    localStorage.setItem('compact_forms_mode', isCompact);
    applyFormsLayout(isCompact);
}

function applyFormsLayout(isCompact) {
    const selectEl = document.getElementById('forms-tabs-select');
    const listEl = document.getElementById('forms-tabs-list');

    if (isCompact) {
        if (selectEl) selectEl.classList.remove('hidden');
        if (listEl) listEl.classList.add('hidden');
    } else {
        if (selectEl) selectEl.classList.add('hidden');
        if (listEl) listEl.classList.remove('hidden');
    }
}

function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

function showAlert(message, icon = 'info') {
    const alertModal = document.getElementById('custom-alert');
    const alertMsg = document.getElementById('custom-alert-msg');
    const alertIcon = document.getElementById('custom-alert-icon');
    
    if (alertMsg) alertMsg.textContent = message;
    if (alertIcon) alertIcon.textContent = icon;
    if (alertModal) alertModal.classList.add('active');
}

function closeAlert() {
    const alertModal = document.getElementById('custom-alert');
    if (alertModal) alertModal.classList.remove('active');
}

/* ==========================================
   4. РЕНДЕР ВКЛАДОК, ПЕРЕИМЕНОВАНИЕ И ВЫБОР ФОРМ
   ========================================== */
function renderAllFormsUI() {
    const selectEl = document.getElementById('forms-tabs-select');
    const listEl = document.getElementById('forms-tabs-list');

    if (selectEl) selectEl.innerHTML = '';
    if (listEl) listEl.innerHTML = '';

    allForms.forEach((form, index) => {
        const formTitle = form.title || `Форма №${index + 1}`;

        // 1. Для компактного вида (Select)
        if (selectEl) {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = formTitle;
            if (index === currentFormIndex) opt.selected = true;
            selectEl.appendChild(opt);
        }

        // 2. Для обычных вкладок с иконкой Карандаша
        if (listEl) {
            const tab = document.createElement('div');
            tab.className = `form-tab ${index === currentFormIndex ? 'active-tab' : ''}`;
            
            tab.innerHTML = `
                <span class="tab-title">${formTitle}</span>
                <button class="edit-tab-btn" onclick="renameForm(${index}, event)" title="Переименовать форму">
                    ✏️
                </button>
            `;

            tab.onclick = () => switchForm(index);
            listEl.appendChild(tab);
        }
    });
}

function renameForm(index, event) {
    if (event) event.stopPropagation(); // Не переключаем вкладку при клике на карандаш

    const form = allForms[index];
    if (!form) return;

    const currentTitle = form.title || `Форма №${index + 1}`;
    const newTitle = prompt("Введите новое название для формы:", currentTitle);

    if (newTitle !== null && newTitle.trim() !== "") {
        allForms[index].title = newTitle.trim();
        saveFormsToStorage();
        renderAllFormsUI();

        const adminScreen = document.getElementById('admin-screen');
        if (adminScreen && !adminScreen.classList.contains('hidden')) {
            renderAdminQuestionsList();
        }

        showAlert('Форма успешно переименована!', 'check_circle');
    }
}

function switchForm(index) {
    currentFormIndex = parseInt(index);
    renderAllFormsUI();
    loadCurrentForm();
}

function switchFormFromSelect(index) {
    switchForm(index);
}

function createNewFormPrompt() {
    const title = prompt("Введите название новой формы:");
    if (title && title.trim()) {
        allForms.push({
            title: title.trim(),
            questions: []
        });
        currentFormIndex = allForms.length - 1;
        saveFormsToStorage();
        renderAllFormsUI();
        loadCurrentForm();
    }
}

/* ==========================================
   5. ДВИЖОК ТЕСТИРОВАНИЯ (QUIZ ENGINE)
   ========================================== */
function loadCurrentForm() {
    currentQuestionIndex = 0;
    userAnswers = {};
    
    document.getElementById('quiz-screen').classList.remove('hidden');
    document.getElementById('quiz-box').classList.remove('hidden');
    document.getElementById('result-box').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');

    renderQuestion();
}

function renderQuestion() {
    stopTimer();
    const form = allForms[currentFormIndex];
    if (!form || !form.questions || form.questions.length === 0) {
        document.getElementById('question-body').innerHTML = '<p style="text-align:center; color:var(--text-muted);">В этой форме пока нет вопросов. Войдите в Панель Админа, чтобы добавить их.</p>';
        document.getElementById('current-number').textContent = '0';
        document.getElementById('total-number').textContent = '0';
        document.getElementById('progress').style.width = '0%';
        document.getElementById('next-btn').classList.add('hidden');
        return;
    }

    document.getElementById('next-btn').classList.remove('hidden');
    const q = form.questions[currentQuestionIndex];
    
    document.getElementById('current-number').textContent = currentQuestionIndex + 1;
    document.getElementById('total-number').textContent = form.questions.length;
    const progressPercent = ((currentQuestionIndex + 1) / form.questions.length) * 100;
    document.getElementById('progress').style.width = `${progressPercent}%`;

    const timerDisplay = document.getElementById('timer-display');
    if (q.timer && q.timer > 0) {
        timerDisplay.classList.remove('hidden');
        startTimer(q.timer);
    } else {
        timerDisplay.classList.add('hidden');
    }

    const hintBtn = document.getElementById('hint-btn');
    const hintBox = document.getElementById('hint-box');
    hintBox.classList.add('hidden');
    if (q.hintText) {
        hintBtn.classList.remove('hidden');
        document.getElementById('hint-text').textContent = q.hintText;
    } else {
        hintBtn.classList.add('hidden');
    }

    const body = document.getElementById('question-body');
    body.innerHTML = `<h3 style="margin-bottom:15px; font-weight:600;">${q.title}</h3>`;

    switch (q.type) {
        case 'radio':
            q.options.forEach((opt, idx) => {
                body.innerHTML += `
                    <label class="option">
                        <input type="radio" name="q_opt" value="${idx}" onchange="saveAnswer(${idx})">
                        <span>${opt}</span>
                    </label>
                `;
            });
            break;

        case 'checkbox':
            q.options.forEach((opt, idx) => {
                body.innerHTML += `
                    <label class="option">
                        <input type="checkbox" name="q_opt" value="${idx}" onchange="saveCheckboxAnswer()">
                        <span>${opt}</span>
                    </label>
                `;
            });
            break;

        case 'text':
            body.innerHTML += `
                <input type="text" class="admin-input" placeholder="Введите ваш ответ..." oninput="saveAnswer(this.value.trim())">
            `;
            break;

        case 'flashcard':
            body.innerHTML += `
                <div class="flashcard-container" onclick="this.querySelector('.flashcard-inner')?.classList.toggle('flipped')">
                    <div class="flashcard">
                        <p style="font-size:14px; color:var(--text-muted); margin-bottom:10px;">Нажмите, чтобы перевернуть 🃏</p>
                        <p style="font-size:18px; font-weight:600;" id="flashcard-text">${q.title}</p>
                    </div>
                </div>
            `;
            saveAnswer('viewed');
            break;

        case 'puzzle-drag':
            let shuffled = q.options.map((opt, idx) => ({ opt, idx }));
            body.innerHTML += `<div id="puzzle-list"></div>`;
            const pList = document.getElementById('puzzle-list');
            
            shuffled.forEach((item) => {
                pList.innerHTML += `
                    <div class="puzzle-item" data-idx="${item.idx}">
                        <span class="material-symbols-rounded" style="color:var(--text-muted);">drag_indicator</span>
                        <span>${item.opt}</span>
                    </div>
                `;
            });
            savePuzzleAnswer();
            initPuzzleEvents();
            break;

        case 'info-slide':
            if (q.mediaUrl) {
                body.innerHTML += `<div style="text-align:center; margin-bottom:15px;"><img src="${q.mediaUrl}" style="max-width:100%; border-radius:12px;"></div>`;
            }
            saveAnswer('viewed');
            break;

        default:
            body.innerHTML += `<p style="color:var(--text-muted);">Тип вопроса поддерживается в упрощенном режиме.</p>`;
            saveAnswer('viewed');
    }
}

function saveAnswer(val) {
    userAnswers[currentQuestionIndex] = val;
}

function saveCheckboxAnswer() {
    const checked = Array.from(document.querySelectorAll('input[name="q_opt"]:checked')).map(el => parseInt(el.value));
    userAnswers[currentQuestionIndex] = checked;
}

function savePuzzleAnswer() {
    const items = Array.from(document.querySelectorAll('.puzzle-item')).map(el => parseInt(el.getAttribute('data-idx')));
    userAnswers[currentQuestionIndex] = items;
}

function initPuzzleEvents() {
    const list = document.getElementById('puzzle-list');
    if (!list) return;

    let dragItem = null;

    list.querySelectorAll('.puzzle-item').forEach(item => {
        item.draggable = true;
        
        item.addEventListener('dragstart', () => {
            dragItem = item;
            item.style.opacity = '0.5';
        });

        item.addEventListener('dragend', () => {
            dragItem = null;
            item.style.opacity = '1';
            savePuzzleAnswer();
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const bounding = item.getBoundingClientRect();
            const offset = e.clientY - bounding.top - (bounding.height / 2);
            if (offset > 0) {
                item.after(dragItem);
            } else {
                item.before(dragItem);
            }
        });
    });
}

function nextStep() {
    const form = allForms[currentFormIndex];
    const q = form.questions[currentQuestionIndex];

    if (q.required && (userAnswers[currentQuestionIndex] === undefined || userAnswers[currentQuestionIndex] === '')) {
        showAlert('Пожалуйста, ответьте на обязательный вопрос!', 'warning');
        return;
    }

    if (currentQuestionIndex < form.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        calculateResults();
    }
}

/* ==========================================
   6. ПОДСЧЕТ РЕЗУЛЬТАТОВ
   ========================================== */
function calculateResults() {
    stopTimer();
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('result-box').classList.remove('hidden');

    const form = allForms[currentFormIndex];
    let score = 0;
    let maxPossibleScore = 0;
    let reviewHTML = '';

    form.questions.forEach((q, idx) => {
        const userAns = userAnswers[idx];

        if (q.type === 'flashcard' || q.type === 'info-slide') {
            reviewHTML += `
                <div class="review-item grey-item">
                    <strong>${q.title}</strong>
                    <p style="color:var(--text-muted); font-size:13px; margin-top:4px;">
                        🃏 Материал изучен ${q.flashcardAnswer ? `(Оборот: ${q.flashcardAnswer})` : ''}
                    </p>
                </div>
            `;
            return;
        }

        maxPossibleScore++;
        let isCorrect = false;

        if (q.type === 'radio') {
            if (q.correctChoices && q.correctChoices.includes(userAns)) {
                isCorrect = true;
            }
        } else if (q.type === 'checkbox') {
            if (Array.isArray(userAns) && q.correctChoices &&
                userAns.length === q.correctChoices.length &&
                userAns.every(v => q.correctChoices.includes(v))) {
                isCorrect = true;
            }
        } else if (q.type === 'text') {
            if (q.correctText && q.correctText.some(t => t.toLowerCase().trim() === String(userAns).toLowerCase().trim())) {
                isCorrect = true;
            }
        } else if (q.type === 'puzzle-drag') {
            if (Array.isArray(userAns) && q.correctChoices &&
                JSON.stringify(userAns) === JSON.stringify(q.correctChoices)) {
                isCorrect = true;
            }
        }

        if (isCorrect) {
            score++;
            reviewHTML += `
                <div class="review-item correct-item">
                    <strong>${q.title}</strong>
                    <p class="text-success" style="font-size:13px; margin-top:4px;">✓ Верно</p>
                </div>
            `;
        } else {
            reviewHTML += `
                <div class="review-item incorrect-item">
                    <strong>${q.title}</strong>
                    <p class="text-danger" style="font-size:13px; margin-top:4px;">✗ Неверно</p>
                </div>
            `;
        }
    });

    document.getElementById('final-score').textContent = `${score} / ${maxPossibleScore}`;
    document.getElementById('review-box').innerHTML = reviewHTML;
}

function restartQuiz() {
    loadCurrentForm();
}

function startTimer(seconds) {
    currentTimerSeconds = seconds;
    document.getElementById('timer-seconds').textContent = currentTimerSeconds;
    
    timerInterval = setInterval(() => {
        currentTimerSeconds--;
        document.getElementById('timer-seconds').textContent = currentTimerSeconds;
        if (currentTimerSeconds <= 0) {
            stopTimer();
            nextStep();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function toggleHintModal() {
    document.getElementById('hint-box').classList.toggle('hidden');
}

/* ==========================================
   7. ЭКСПОРТ И ИМПОРТ JSON
   ========================================== */
function exportFormToJSON() {
    const currentForm = allForms[currentFormIndex];
    if (!currentForm) {
        showAlert('Нет выбранной формы для экспорта', 'error');
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentForm, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentForm.title || 'form'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showAlert('Форма успешно экспортирована в файл JSON!', 'check_circle');
}

function importFormFromJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData && importedData.questions && Array.isArray(importedData.questions)) {
                allForms.push(importedData);
            } else if (Array.isArray(importedData)) {
                allForms.push(...importedData);
            } else {
                throw new Error('Файл не содержит корректных вопросов.');
            }

            saveFormsToStorage();
            currentFormIndex = allForms.length - 1;
            renderAllFormsUI();
            loadCurrentForm();
            
            if (!document.getElementById('admin-screen').classList.contains('hidden')) {
                renderAdminQuestionsList();
            }

            showAlert('Новая форма успешно импортирована!', 'check_circle');
        } catch (err) {
            showAlert('Ошибка импорта: ' + err.message, 'error');
        }
        input.value = '';
    };
    reader.readAsText(file);
}

/* ==========================================
   8. ПАНЕЛЬ АДМИНИСТРАТОРА (ADMIN PANEL)
   ========================================== */
function switchScreen(screen) {
    if (screen === 'login') {
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('admin-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    } else if (screen === 'admin') {
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-screen').classList.remove('hidden');
        renderAdminQuestionsList();
    }
}

function tryLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;

    if (u === 'admin' && p === '1234') {
        switchScreen('admin');
    } else {
        showAlert('Неверный логин или пароль!', 'lock');
    }
}

function logout() {
    loadCurrentForm();
}

function toggleAddQuestionForm() {
    document.getElementById('admin-add-form').classList.toggle('hidden');
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    
    document.getElementById('admin-choices-fields').classList.toggle('hidden', !['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type));
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('media-upload-box').classList.toggle('hidden', type !== 'info-slide');
}

function addQuestion() {
    const form = allForms[currentFormIndex];
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();

    if (!title) {
        showAlert('Введите текст вопроса!', 'warning');
        return;
    }

    const newQ = {
        type: type,
        title: title,
        required: document.getElementById('new-required').checked
    };

    if (['radio', 'checkbox', 'select', 'puzzle-drag'].includes(type)) {
        const opts = document.getElementById('new-options').value.split(',').map(s => s.trim()).filter(Boolean);
        const correct = document.getElementById('new-correct-choices').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        newQ.options = opts;
        newQ.correctChoices = correct;
    } else if (type === 'text') {
        newQ.correctText = document.getElementById('new-correct-text').value.split(',').map(s => s.trim()).filter(Boolean);
    } else if (type === 'flashcard') {
        newQ.flashcardAnswer = document.getElementById('new-flashcard-answer').value.trim();
    } else if (type === 'info-slide' && uploadedMediaBase64) {
        newQ.mediaUrl = uploadedMediaBase64;
    }

    if (document.getElementById('toggle-hint-input').checked) {
        newQ.hintText = document.getElementById('new-hint-text').value.trim();
    }
    if (document.getElementById('toggle-timer-input').checked) {
        newQ.timer = parseInt(document.getElementById('new-timer').value) || 20;
    }

    form.questions.push(newQ);
    saveFormsToStorage();
    renderAdminQuestionsList();
    toggleAddQuestionForm();
    showAlert('Вопрос успешно сохранён!', 'check_circle');
}

function renderAdminQuestionsList() {
    const list = document.getElementById('admin-questions-list');
    const form = allForms[currentFormIndex];
    if (!list || !form) return;

    list.innerHTML = `<h3>Вопросы формы "${form.title}" (${form.questions.length}):</h3>`;

    form.questions.forEach((q, idx) => {
        list.innerHTML += `
            <div class="gcard" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${idx + 1}. ${q.title}</strong>
                    <span style="font-size:12px; color:var(--text-muted); display:block;">Тип: ${q.type}</span>
                </div>
                <button onclick="deleteQuestion(${idx})" class="btn" style="background:#d32f2f; padding:6px 12px; font-size:12px;">Удалить</button>
            </div>
        `;
    });
}

function deleteQuestion(idx) {
    allForms[currentFormIndex].questions.splice(idx, 1);
    saveFormsToStorage();
    renderAdminQuestionsList();
}

function handleMediaUploadPreview(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedMediaBase64 = e.target.result;
            document.getElementById('media-preview-container').innerHTML = `<img src="${uploadedMediaBase64}" style="max-width:100px; margin-top:10px; border-radius:8px;">`;
        };
        reader.readAsDataURL(file);
    }
}

/* ==========================================
   9. ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
   ========================================== */
function generateShareLink() {
    navigator.clipboard.writeText(window.location.href);
    showAlert('Ссылка на форму скопирована в буфер обмена!', 'share');
}

function printCurrentForm() {
    window.print();
}
// Открытие модального окна настроек
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

// Закрытие модального окна настроек
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Открытие / закрытие меню трех точек (more_vert)
function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Переключение темы (светлая / тёмная)
function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
    }
}

// Переключение компактного вида форм (Select / Вкладки)
function toggleFormsLayout(isCompact) {
    const select = document.getElementById('forms-tabs-select');
    const list = document.getElementById('forms-tabs-list');
    
    if (select && list) {
        if (isCompact) {
            select.classList.remove('hidden');
            list.classList.add('hidden');
        } else {
            select.classList.add('hidden');
            list.classList.remove('hidden');
        }
    }
}
