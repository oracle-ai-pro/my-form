// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let questions = [];
let currentIndex = 0;
let userAnswers = [];
let currentTimerInterval = null;
let currentTheme = 'light';
let isExplanationState = false;

// 1. ЗАГРУЗКА И ТЕМЫ
function loadQuestions() {
    let saved = localStorage.getItem('quiz_questions');
    return saved ? JSON.parse(saved) : [];
}

function setTheme(theme) {
    currentTheme = theme;
    const isDark = theme === 'dark';
    document.body.style.backgroundColor = isDark ? '#121214' : '#f4f4f9';
    document.body.style.color = isDark ? '#ffffff' : '#333333';
    
    document.querySelectorAll('.quiz-container, .admin-box, .admin-item').forEach(el => {
        el.style.backgroundColor = isDark ? '#1e1e22' : '#ffffff';
        el.style.borderColor = isDark ? '#333338' : '#eee';
    });
    
    document.querySelectorAll('input, select').forEach(el => {
        el.style.backgroundColor = isDark ? '#2a2a30' : '#ffffff';
        el.style.color = isDark ? '#fff' : '#000';
    });
    document.getElementById('tools-menu').classList.add('hidden');
}

function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }

// 2. БЕЗОПАСНАЯ ЛОГИКА ПЕРЕХОДА
function nextStep(isTimeout = false) {
    const q = questions[currentIndex];
    if (isExplanationState) {
        currentIndex++;
        if (currentIndex < questions.length) renderQuestion(); else showResults();
        return;
    }

    let answers = [];
    let rawValue = "";

    if (!isTimeout) {
        // Сбор ответа
        if (q.type === 'radio') {
            let checked = document.querySelector('input[name="quiz_ans"]:checked');
            if (checked) { answers.push(parseInt(checked.value)); rawValue = q.options[checked.value]; }
        } else if (q.type === 'checkbox') {
            document.querySelectorAll('input[name="quiz_ans"]:checked').forEach(cb => answers.push(parseInt(cb.value)));
            rawValue = answers.map(i => q.options[i]).join(', ');
        } else if (q.type === 'select') {
            let sel = document.getElementById('quiz_select').value;
            if(sel !== "") { answers.push(parseInt(sel)); rawValue = q.options[sel]; }
        } else if (q.type === 'text') {
            rawValue = document.getElementById('quiz_text').value.trim();
        }

        // БЛОКИРОВКА
        if (q.required && answers.length === 0 && rawValue === "") { alert("Ответ обязателен!"); return; }
        
        let isCorrect = false;
        if (q.type === 'text') {
            isCorrect = q.correctText.some(t => t.toLowerCase().trim() === rawValue.toLowerCase().trim());
        } else {
            isCorrect = q.correct.length === answers.length && q.correct.every(v => answers.includes(v));
        }

        if (!isCorrect) { alert("Неверно! Попробуйте еще раз."); return; }
    }

    clearInterval(currentTimerInterval);
    userAnswers.push({ title: q.title, ans: rawValue, isCorrect: true });
    
    // Объяснение...
    currentIndex++;
    if (currentIndex < questions.length) renderQuestion(); else showResults();
}

// 3. АДМИНКА (Сбор данных со всех полей)
function addQuestion() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value;
    const isRequired = document.getElementById('new-required').checked;
    const timer = parseInt(document.getElementById('new-timer').value);
    
    let newQ = { type, title, required: isRequired, timer: timer };

    if (type === 'text') {
        newQ.correctText = document.getElementById('new-correct-text').value.split(',').map(s => s.trim());
    } else {
        newQ.options = document.getElementById('new-options').value.split(',').map(s => s.trim());
        newQ.correct = document.getElementById('new-correct-choices').value.split(',').map(s => parseInt(s.trim()));
    }

    questions.push(newQ);
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    alert("Вопрос добавлен!");
    renderAdminQuestions();
}

// ... ОСТАЛЬНЫЕ ФУНКЦИИ (switchScreen, generateShareLink и т.д.)
