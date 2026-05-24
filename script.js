// Функция редактирования (вызывается при клике на ✏️)
function editQuestion(index) {
    const q = questions[index];
    document.getElementById('edit-index').value = index;
    document.getElementById('new-title').value = q.title;
    document.getElementById('new-type').value = q.type;
    toggleAdminFields();
    
    if (q.type === 'text') {
        document.getElementById('new-correct-text').value = q.correctText.join(', ');
    } else {
        document.getElementById('new-options').value = q.options.join(', ');
        document.getElementById('new-correct-choices').value = q.correct.join(', ');
    }
    document.getElementById('admin-form-title').innerText = "Редактирование вопроса №" + (index + 1);
    document.getElementById('save-btn').innerText = "Обновить вопрос";
}

// Универсальная функция сохранения (и для нового, и для правки)
function addQuestion() {
    const editIdx = parseInt(document.getElementById('edit-index').value);
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value;
    
    let newQ = { type, title };
    // ... логика сборки объекта как была раньше ...

    if (editIdx > -1) {
        questions[editIdx] = newQ; // Обновляем существующий
    } else {
        questions.push(newQ); // Добавляем новый
    }
    
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
    // Сброс формы
    document.getElementById('edit-index').value = -1;
    document.getElementById('admin-form-title').innerText = "Добавить новый вопрос";
    document.getElementById('save-btn').innerText = "Сохранить вопрос";
    renderAdminQuestions();
}

// Отображение списка с кнопками ✏️ и 👁️
function renderAdminQuestions() {
    const list = document.getElementById('admin-questions-list');
    list.innerHTML = '';
    questions.forEach((q, i) => {
        list.innerHTML += `
            <div class="admin-item">
                ${q.title}
                <button onclick="editQuestion(${i})">✏️</button>
                <button onclick="previewQuestion(${i})">👁️</button>
                <button onclick="deleteQuestion(${i})" style="color:red;">❌</button>
            </div>
        `;
    });
}
