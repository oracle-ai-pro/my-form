let questions = JSON.parse(localStorage.getItem('quiz_questions')) || [];
let editingIndex = -1;

function switchScreen(id) {
    document.querySelectorAll('.quiz-container').forEach(el => el.classList.add('hidden'));
    document.getElementById(id + '-screen').classList.remove('hidden');
}

function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }

function setTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
    localStorage.setItem('theme', theme);
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    document.getElementById('admin-choices-fields').classList.toggle('hidden', type === 'text');
    document.getElementById('admin-text-fields').classList.toggle('hidden', type !== 'text');
}

function addQuestion() {
    const q = {
        title: document.getElementById('new-title').value,
        type: document.getElementById('new-type').value,
        options: document.getElementById('new-options').value.split(','),
        correct: document.getElementById('new-correct-choices').value.split(','),
        correctText: document.getElementById('new-correct-text').value
    };
    if (editingIndex === -1) questions.push(q);
    else questions[editingIndex] = q;
    
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    editingIndex = -1;
    renderAdminList();
    alert("Сохранено!");
}

function renderAdminList() {
    const list = document.getElementById('admin-questions-list');
    list.innerHTML = questions.map((q, i) => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #444;">
            ${q.title}
            <div>
                <button onclick="editQuestion(${i})" style="width:auto; padding:5px;">✎</button>
                <button onclick="deleteQuestion(${i})" style="width:auto; padding:5px; background:red;">✕</button>
            </div>
        </div>
    `).join('');
}

function editQuestion(i) {
    editingIndex = i;
    document.getElementById('new-title').value = questions[i].title;
    switchScreen('admin');
}

function deleteQuestion(i) { questions.splice(i, 1); localStorage.setItem('quiz_questions', JSON.stringify(questions)); renderAdminList(); }

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    renderAdminList();
});
