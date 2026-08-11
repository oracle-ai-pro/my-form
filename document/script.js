// Базовое состояние
let allDocs = [];
let currentDocIndex = 0;
let currentStep = 0;
let isAdmin = false;
let contextTargetIndex = null;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadDocs();
    
    // Если пусто, создаем первый дефолтный документ
    if (allDocs.length === 0) {
        allDocs.push({ id: Date.now(), title: 'Добро пожаловать', blocks: [] });
        saveDocs();
    }
    
    renderTabs();
    renderDocScreen();
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Закрываем контекстное меню при клике в любое место
    document.addEventListener('click', closeContextMenu);
});

// --- СИСТЕМА СОХРАНЕНИЯ В БРАУЗЕРЕ ---
function loadDocs() {
    const saved = localStorage.getItem('myDocsData');
    if (saved) {
        try {
            allDocs = JSON.parse(saved);
        } catch(e) { console.error("Ошибка чтения памяти", e); }
    }
}
function saveDocs() {
    localStorage.setItem('myDocsData', JSON.stringify(allDocs));
}

// --- ВКЛАДКИ ДОКУМЕНТОВ И КОНТЕКСТНОЕ МЕНЮ (ПКМ) ---
function renderTabs() {
    const list = document.getElementById('forms-tabs-list');
    const select = document.getElementById('forms-tabs-select');
    
    if(!list || !select) return;
    list.innerHTML = '';
    select.innerHTML = '';

    allDocs.forEach((doc, idx) => {
        // Рендер кнопок
        const btn = document.createElement('button');
        btn.className = `btn ${idx === currentDocIndex ? '' : 'btn-secondary'}`;
        btn.innerText = doc.title;
        btn.style.whiteSpace = 'nowrap';
        btn.onclick = () => switchDoc(idx);
        
        // Назначение ПКМ (контекстное меню)
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            showContextMenu(e, idx);
        };

        list.appendChild(btn);

        // Рендер мобильного селекта
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = doc.title;
        if (idx === currentDocIndex) opt.selected = true;
        select.appendChild(opt);
    });

    // Показываем селект на мобильных
    if (window.innerWidth < 600) {
        list.classList.add('hidden');
        select.classList.remove('hidden');
    }
}

function showContextMenu(e, idx) {
    contextTargetIndex = idx;
    const menu = document.getElementById('tab-context-menu');
    
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.remove('hidden');

    document.getElementById('ctx-rename-btn').onclick = () => {
        closeContextMenu();
        renameDocAtIndex(contextTargetIndex);
    };

    document.getElementById('ctx-delete-btn').onclick = () => {
        closeContextMenu();
        deleteDocAtIndex(contextTargetIndex);
    };
}

function closeContextMenu() {
    const menu = document.getElementById('tab-context-menu');
    if (menu) menu.classList.add('hidden');
}

function switchDoc(idx) {
    currentDocIndex = parseInt(idx);
    currentStep = 0;
    renderTabs();
    if (isAdmin) renderAdminBlocksList();
    else renderDocScreen();
}

function switchDocFromSelect(idx) {
    switchDoc(idx);
}

// --- ИНТЕРФЕЙС ЧТЕНИЯ ---
function renderDocScreen() {
    const doc = allDocs[currentDocIndex];
    if (!doc) return;

    document.getElementById('doc-display-title').innerText = doc.title;
    const blocks = doc.blocks || [];
    
    document.getElementById('total-number').innerText = Math.max(1, blocks.length);
    document.getElementById('current-number').innerText = currentStep + 1;

    document.getElementById('doc-box').classList.remove('hidden');
    document.getElementById('result-box').classList.add('hidden');

    if (blocks.length === 0) {
        document.getElementById('document-body').innerHTML = '<p style="color:var(--text-muted);">В этом документе пока нет блоков. Войдите в панель редактора, чтобы добавить их.</p>';
        document.getElementById('progress').style.width = '100%';
        document.getElementById('next-btn').classList.add('hidden');
        return;
    }

    const block = blocks[currentStep];
    const body = document.getElementById('document-body');
    
    body.style.opacity = 0;
    setTimeout(() => {
        body.innerHTML = `<h3>${block.title}</h3>`;

        if (block.description) {
            body.innerHTML += `<p>${block.description.replace(/\n/g, '<br>')}</p>`;
        }

        switch (block.type) {
            case 'a4-sheet':
                body.innerHTML += `<div class="a4-paper-view">${block.htmlContent || ''}</div>`;
                break;
            case 'interactive-fields':
                body.innerHTML += `<input type="text" class="admin-input" placeholder="Введите ответ...">`;
                break;
            case 'checklist':
                if (block.options) {
                    block.options.forEach(opt => {
                        body.innerHTML += `<label style="display:block; margin-top:8px;"><input type="checkbox"> ${opt}</label>`;
                    });
                }
                break;
        }

        body.style.transition = 'opacity 0.3s';
        body.style.opacity = 1;
    }, 100);

    const progressPercent = ((currentStep) / blocks.length) * 100;
    document.getElementById('progress').style.width = `${progressPercent}%`;

    document.getElementById('prev-btn').classList.toggle('hidden', currentStep === 0);
    document.getElementById('next-btn').innerText = (currentStep === blocks.length - 1) ? 'Завершить' : 'Далее';
    document.getElementById('next-btn').classList.remove('hidden');
}

function nextStep() {
    const doc = allDocs[currentDocIndex];
    if (currentStep < (doc.blocks || []).length - 1) {
        currentStep++;
        renderDocScreen();
    } else {
        document.getElementById('doc-box').classList.add('hidden');
        document.getElementById('result-box').classList.remove('hidden');
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        renderDocScreen();
    }
}

function restartDocView() {
    currentStep = 0;
    renderDocScreen();
}

// --- ПЕЧАТЬ И ПРЕДПРОСМОТР В about:blank ---
function printCurrentDoc() {
    const doc = allDocs[currentDocIndex];
    if (!doc) return;

    let contentHTML = `<h1>${doc.title}</h1><hr style="border:none; border-top:2px solid #000; margin: 20px 0;">`;

    if (!doc.blocks || doc.blocks.length === 0) {
        contentHTML += `<p>Документ пуст.</p>`;
    } else {
        doc.blocks.forEach((block, idx) => {
            contentHTML += `<div style="margin-bottom: 30px;">`;
            contentHTML += `<h2>${idx + 1}. ${block.title}</h2>`;
            if (block.description) {
                contentHTML += `<p>${block.description.replace(/\n/g, '<br>')}</p>`;
            }
            if (block.type === 'a4-sheet' && block.htmlContent) {
                contentHTML += `<div style="border:1px solid #ccc; padding:15px; margin-top:10px;">${block.htmlContent}</div>`;
            } else if (block.type === 'checklist' && block.options) {
                block.options.forEach(opt => {
                    contentHTML += `<div style="margin-top:5px;">☐ ${opt}</div>`;
                });
            }
            contentHTML += `</div>`;
        });
    }

    // Открываем about:blank
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
        return showAlert('Браузер заблокировал всплывающее окно! Разрешите их для этого сайта.');
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Печать: ${doc.title}</title>
            <style>
                body {
                    font-family: 'Times New Roman', Times, serif;
                    padding: 40px;
                    background: #f0f0f0;
                    margin: 0;
                }
                .toolbar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #333;
                    color: white;
                    padding: 10px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                }
                .btn-print {
                    background: #27ae60;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                }
                .btn-close {
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .sheet {
                    background: white;
                    max-width: 800px;
                    margin: 60px auto 20px auto;
                    padding: 50px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                    min-height: 1000px;
                    outline: none;
                }
                @media print {
                    .toolbar { display: none !important; }
                    body { background: white; padding: 0; }
                    .sheet { box-shadow: none; margin: 0; padding: 0; max-width: 100%; }
                }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <span>Предпросмотр перед печатью (текст ниже можно редактировать)</span>
                <div>
                    <button class="btn-print" onclick="window.print()">🖨️ Распечатать</button>
                    <button class="btn-close" onclick="window.close()">✕ Закрыть</button>
                </div>
            </div>

            <!-- Редактируемая область перед печатью -->
            <div class="sheet" contenteditable="true">
                ${contentHTML}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// --- УПРАВЛЕНИЕ ДОКУМЕНТОМ (Переименовать/Удалить) ---
function updateAdminDocName() {
    const docNameEl = document.getElementById('admin-current-doc-name');
    if (docNameEl && allDocs[currentDocIndex]) {
        docNameEl.innerText = allDocs[currentDocIndex].title;
    }
}

function renameDocAtIndex(index) {
    if (index < 0 || index >= allDocs.length) return;
    
    document.getElementById('custom-prompt-title').innerText = 'Новое название документа';
    document.getElementById('custom-prompt-input').value = allDocs[index].title;
    document.getElementById('custom-prompt').classList.remove('hidden');
    
    promptCallback = function(val) {
        if (val && val.trim() !== '') {
            allDocs[index].title = val.trim();
            saveDocs();
            renderTabs();
            updateAdminDocName();
            if (!isAdmin) renderDocScreen();
            showAlert('Документ успешно переименован!');
        }
    };
}

function deleteDocAtIndex(index) {
    if (allDocs.length <= 1) {
        return showAlert('Нельзя удалить единственный документ! Создайте новый перед удалением.');
    }
    
    if (confirm(`Вы уверены, что хотите навсегда удалить документ "${allDocs[index].title}"?`)) {
        allDocs.splice(index, 1);
        if (currentDocIndex >= allDocs.length) {
            currentDocIndex = allDocs.length - 1;
        }
        saveDocs();
        renderTabs();
        if (isAdmin) renderAdminBlocksList();
        else renderDocScreen();
        showAlert('Документ удален!');
    }
}

// --- АДМИНКА И РЕДАКТОР ---
function openLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }

function tryLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    if (u === 'admin' && p === '1234') { 
        isAdmin = true;
        closeLoginModal();
        document.getElementById('doc-screen').classList.add('hidden');
        document.getElementById('admin-screen').classList.remove('hidden');
        renderAdminBlocksList();
        showAlert('Вход выполнен. Режим редактора активен.');
    } else {
        showAlert('Неверный логин или пароль (admin / 1234)');
    }
}

function logout() {
    isAdmin = false;
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('doc-screen').classList.remove('hidden');
    currentStep = 0;
    renderDocScreen();
}

function toggleAddBlockForm() {
    document.getElementById('admin-add-form').classList.toggle('hidden');
}

function toggleAdminFields() {
    const type = document.getElementById('new-type').value;
    
    document.getElementById('a4-editor-box').classList.toggle('hidden', type !== 'a4-sheet');
    document.getElementById('desc-field-box').classList.toggle('hidden', type === 'a4-sheet');
    document.getElementById('admin-choices-fields').classList.toggle('hidden', type !== 'checklist');
    document.getElementById('flashcard-answer-box').classList.toggle('hidden', type !== 'flashcard');
    document.getElementById('media-upload-box').classList.toggle('hidden', type !== 'info-slide');
}

function execEditorCmd(cmd, value = null) {
    document.execCommand(cmd, false, value);
}

function addBlock() {
    const type = document.getElementById('new-type').value;
    const title = document.getElementById('new-title').value.trim();
    const desc = document.getElementById('new-description').value.trim();

    if (!title) return showAlert('Введите заголовок!');

    const doc = allDocs[currentDocIndex];
    if (!doc.blocks) doc.blocks = [];

    const newBlock = {
        id: Date.now(),
        type: type,
        title: title,
        description: type === 'a4-sheet' ? '' : desc,
        required: document.getElementById('new-required').checked
    };

    if (type === 'a4-sheet') {
        const a4HTML = document.getElementById('a4-editor-content').innerHTML;
        if (!a4HTML.trim()) return showAlert('Заполните содержимое Листа А4!');
        newBlock.htmlContent = a4HTML;
    } else if (type === 'checklist') {
        newBlock.options = document.getElementById('new-options').value.split(',').map(s => s.trim()).filter(Boolean);
    }

    doc.blocks.push(newBlock);
    saveDocs();
    cancelEditBlock();
    renderAdminBlocksList();
    showAlert('Блок успешно добавлен!');
}

function cancelEditBlock() {
    document.getElementById('new-title').value = '';
    document.getElementById('new-description').value = '';
    document.getElementById('a4-editor-content').innerHTML = ''; 
    document.getElementById('new-options').value = '';
    document.getElementById('admin-add-form').classList.add('hidden');
    toggleAdminFields();
}

function renderAdminBlocksList() {
    updateAdminDocName();
    
    const doc = allDocs[currentDocIndex];
    const list = document.getElementById('admin-questions-list');
    if (!list) return;
    list.innerHTML = '';
    
    if(!doc || !doc.blocks || doc.blocks.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);">Нет блоков. Нажмите "+ Добавить блок".</p>';
        return;
    }

    doc.blocks.forEach((b, index) => {
        const item = document.createElement('div');
        item.className = 'gcard';
        item.style.padding = '15px';
        item.innerHTML = `
            <strong>${index + 1}. ${b.title}</strong> <span style="color:var(--text-muted); font-size:12px;">(${b.type})</span>
            <button class="btn btn-secondary" style="float:right; padding:4px 8px; font-size:12px;" onclick="deleteBlock(${index})">Удалить</button>
        `;
        list.appendChild(item);
    });
}

function deleteBlock(index) {
    allDocs[currentDocIndex].blocks.splice(index, 1);
    saveDocs();
    renderAdminBlocksList();
}

// --- УТИЛИТЫ И МОДАЛКИ ---
function toggleToolsMenu() { document.getElementById('tools-menu').classList.toggle('hidden'); }
function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function showAlert(msg) {
    document.getElementById('custom-alert-msg').innerText = msg;
    document.getElementById('custom-alert').classList.remove('hidden');
}
function closeAlert() {
    document.getElementById('custom-alert').classList.add('hidden');
}

// --- СОЗДАНИЕ ДОКУМЕНТА (PROMPT) ---
let promptCallback = null;
function createNewDocPrompt() {
    document.getElementById('custom-prompt-title').innerText = 'Название нового документа';
    document.getElementById('custom-prompt-input').value = '';
    document.getElementById('custom-prompt').classList.remove('hidden');
    
    promptCallback = function(val) {
        if (val) {
            allDocs.push({ id: Date.now(), title: val, blocks: [] });
            currentDocIndex = allDocs.length - 1;
            saveDocs();
            renderTabs();
            if (isAdmin) renderAdminBlocksList();
            else renderDocScreen();
            showAlert(`Документ "${val}" создан!`);
        }
    };
}

function closePrompt(isConfirm) {
    document.getElementById('custom-prompt').classList.add('hidden');
    if (isConfirm && promptCallback) {
        promptCallback(document.getElementById('custom-prompt-input').value.trim());
    }
    promptCallback = null;
}

// --- ЭКСПОРТ И ИМПОРТ ---
function exportDocToJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allDocs));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "prestige_docs_export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showAlert('Все документы успешно скачаны!');
}

function importDocFromJSON(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                allDocs = imported;
                saveDocs();
                currentDocIndex = 0;
                renderTabs();
                if (isAdmin) renderAdminBlocksList();
                else renderDocScreen();
                showAlert('База документов успешно обновлена!');
            } else {
                showAlert('Неверный формат файла!');
            }
        } catch (err) {
            showAlert('Ошибка чтения файла!');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

function generateShareLink() {
    showAlert('Для публичных ссылок необходима серверная часть.');
}

// --- ИИ ГЕНЕРАТОР ---
function openAiModal() { document.getElementById('ai-modal').classList.remove('hidden'); }
function closeAiModal() { document.getElementById('ai-modal').classList.add('hidden'); }
function switchAiMode(mode) {
    document.getElementById('ai-tab-gen').classList.toggle('btn-secondary', mode !== 'generate');
    document.getElementById('ai-tab-chat').classList.toggle('btn-secondary', mode !== 'chat');
    document.getElementById('ai-mode-generate-container').classList.toggle('hidden', mode !== 'generate');
    document.getElementById('ai-mode-chat-container').classList.toggle('hidden', mode !== 'chat');
}

function generateAiDocument() {
    const promptInput = document.getElementById('ai-prompt-input').value.trim();
    if (!promptInput) return showAlert('Введите тему документа!');
    
    showAlert('ИИ генерирует структуру...');
    closeAiModal();
    
    setTimeout(() => {
        allDocs.push({
            id: Date.now(),
            title: `Сгенерировано: ${promptInput}`,
            blocks: [
                {
                    id: Date.now()+1,
                    type: 'a4-sheet',
                    title: 'Общие положения',
                    htmlContent: `<h1>${promptInput}</h1><p>Этот документ был автоматически сгенерирован алгоритмом ИИ на основе вашего запроса. Вы можете свободно редактировать этот текст.</p><ul><li>Пункт 1</li><li>Пункт 2</li></ul>`
                }
            ]
        });
        currentDocIndex = allDocs.length - 1;
        saveDocs();
        renderTabs();
        if (isAdmin) renderAdminBlocksList();
        else renderDocScreen();
        showAlert('Документ успешно сгенерирован!');
    }, 1500);
}

function sendAiChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    const history = document.getElementById('ai-chat-history');
    history.innerHTML += `<div style="text-align:right; margin-bottom:10px;"><span style="background:var(--accent-color); color:#fff; padding:6px 12px; border-radius:12px; display:inline-block; font-size:13px;">${msg}</span></div>`;
    input.value = '';
    
    setTimeout(() => {
        history.innerHTML += `<div style="text-align:left; margin-bottom:10px;"><span style="background:var(--bg-color); border:1px solid var(--border-color); padding:6px 12px; border-radius:12px; display:inline-block; font-size:13px;">Я демо-версия ИИ. Для реальных ответов потребуется подключение к API!</span></div>`;
        history.scrollTop = history.scrollHeight;
    }, 800);
}
