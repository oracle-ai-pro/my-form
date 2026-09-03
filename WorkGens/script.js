// --- Состояние системы ---
const STATE = {
  theme: localStorage.getItem('wg_theme') || 'dark',
  apiKey: localStorage.getItem('wg_api_key') || '',
  model: 'plan', // 'plan' | 'agent'
  limit: parseInt(localStorage.getItem('wg_limit')) || 100,
  lastReset: parseInt(localStorage.getItem('wg_last_reset')) || Date.now(),
  abortController: null,
  chats: JSON.parse(localStorage.getItem('wg_chats')) || [],
  activeChatId: null,
  isGenerating: false,
  lastPrompt: '',
  selectedContextChatId: null,
  recognition: null,
  attachedFile: null,
  studioContent: '',
  activeGenService: 'document'
};

// Системный промпт для основного агента
const SYSTEM_PROMPT = `Ты — WorkGens AI, умный встроенный ассистент экосистемы My Work (Document, Spreadsheets, Forms, Slides, Keeps).
У тебя есть доступ к специальной панеле "Студия" (Studio), куда ты можешь подготавливать черновики документов, таблицы, структуры презентаций, формы и заметки для последующего экспорта в сервисы My Work.
Отвечай точно, структурировано и помогай пользователю подготавливать проекты.`;

// Системный промпт для быстрого планировщика
const PLAN_SYSTEM_PROMPT = `Ты — планировщик задач WorkGens. 
Твоя ЕДИНСТВЕННАЯ задача — составить краткий, структурированный, пошаговый план (чек-лист) для выполнения задачи пользователя. 
НЕ генерируй готовые тексты, статьи, документы или код. Пиши только шаги (1, 2, 3...) без лишних вступлений.`;

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLimitsTimer();
  initSpeechRecognition();
  renderChatList();
  setupEventListeners();
  setupContextMenu();
  checkApiKeyOnStart();
});

// --- Проверка API-ключа при старте ---
function checkApiKeyOnStart() {
  if (!STATE.apiKey) {
    document.getElementById('onboardingModal').classList.remove('hidden');
  } else {
    document.getElementById('onboardingModal').classList.add('hidden');
  }
}

// --- Работа с темой ---
function initTheme() {
  document.documentElement.setAttribute('data-theme', STATE.theme);
}

function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', STATE.theme);
  localStorage.setItem('wg_theme', STATE.theme);
}

// --- Лимиты (3 часа) ---
function initLimitsTimer() {
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  
  function updateTimer() {
    const now = Date.now();
    const elapsed = now - STATE.lastReset;

    if (elapsed >= THREE_HOURS) {
      STATE.limit = 100;
      STATE.lastReset = now;
      localStorage.setItem('wg_limit', 100);
      localStorage.setItem('wg_last_reset', now);
    }

    const remaining = THREE_HOURS - (elapsed % THREE_HOURS);
    const hours = Math.floor(remaining / (1000 * 60 * 60)).toString().padStart(2, '0');
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000).toString().padStart(2, '0');

    document.getElementById('limitTimer').innerText = `Сброс: ${hours}:${minutes}:${seconds}`;
    document.getElementById('limitValue').innerText = `${STATE.limit}%`;
    document.getElementById('limitFill').style.width = `${STATE.limit}%`;
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

function consumeLimit(amount) {
  STATE.limit = Math.max(0, STATE.limit - amount);
  localStorage.setItem('wg_limit', STATE.limit);
  document.getElementById('limitValue').innerText = `${STATE.limit}%`;
  document.getElementById('limitFill').style.width = `${STATE.limit}%`;
}

// --- Микрофон ---
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('micBtn').style.display = 'none';
    return;
  }

  STATE.recognition = new SpeechRecognition();
  STATE.recognition.lang = 'ru-RU';
  STATE.recognition.continuous = false;
  STATE.recognition.interimResults = false;

  const micBtn = document.getElementById('micBtn');

  STATE.recognition.onstart = () => micBtn.classList.add('recording');
  STATE.recognition.onend = () => micBtn.classList.remove('recording');

  STATE.recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const input = document.getElementById('promptInput');
    input.value = input.value ? `${input.value} ${transcript}` : transcript;
  };

  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('recording')) {
      STATE.recognition.stop();
    } else {
      STATE.recognition.start();
    }
  });
}

// --- Управление чатами ---
function createNewChatState() {
  STATE.activeChatId = null;
  document.getElementById('chatWelcome').classList.remove('hidden');
  document.getElementById('chatMessages').classList.add('hidden');
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('activeChatTitle').innerText = 'Новый чат';
  renderChatList();
}

function saveChats() {
  localStorage.setItem('wg_chats', JSON.stringify(STATE.chats));
}

function renderChatList() {
  const list = document.getElementById('chatList');
  list.innerHTML = '';

  STATE.chats.forEach(chat => {
    const li = document.createElement('li');
    li.dataset.id = chat.id;
    if (chat.id === STATE.activeChatId) li.classList.add('active');

    li.innerHTML = `
      <span class="material-symbols-rounded">chat_bubble</span>
      <span class="item-text">${escapeHtml(chat.title)}</span>
    `;

    li.addEventListener('click', () => openChat(chat.id));
    li.addEventListener('contextmenu', (e) => showContextMenu(e, chat.id));

    list.appendChild(li);
  });
}

function openChat(id) {
  const chat = STATE.chats.find(c => c.id === id);
  if (!chat) return;

  STATE.activeChatId = chat.id;
  document.getElementById('chatWelcome').classList.add('hidden');
  const chatMessages = document.getElementById('chatMessages');
  chatMessages.classList.remove('hidden');
  chatMessages.innerHTML = '';

  chat.messages.forEach(msg => appendMessage(msg.text, msg.sender, false));

  document.getElementById('activeChatTitle').innerText = chat.title;
  renderChatList();
}

// --- Контекстное меню (ПКМ) ---
function setupContextMenu() {
  const menu = document.getElementById('contextMenu');

  document.addEventListener('click', () => menu.classList.add('hidden'));

  document.getElementById('ctxRename').addEventListener('click', async () => {
    if (!STATE.selectedContextChatId) return;
    const chat = STATE.chats.find(c => c.id === STATE.selectedContextChatId);
    if (!chat) return;

    const newTitle = await showCustomDialog({
      title: 'Переименование чата',
      message: 'Введите новое название для этого чата:',
      isInput: true,
      defaultValue: chat.title
    });

    if (newTitle) {
      chat.title = newTitle;
      saveChats();
      renderChatList();
      if (chat.id === STATE.activeChatId) {
        document.getElementById('activeChatTitle').innerText = chat.title;
      }
      showToast('Чат переименован', 'success');
    }
  });

  document.getElementById('ctxDelete').addEventListener('click', async () => {
    if (!STATE.selectedContextChatId) return;

    const confirmed = await showCustomDialog({
      title: 'Удаление чата',
      message: 'Вы уверены, что хотите удалить этот чат?',
      danger: true
    });

    if (confirmed) {
      STATE.chats = STATE.chats.filter(c => c.id !== STATE.selectedContextChatId);
      saveChats();
      if (STATE.activeChatId === STATE.selectedContextChatId) {
        createNewChatState();
      } else {
        renderChatList();
      }
      showToast('Чат удален', 'success');
    }
  });
}

function showContextMenu(e, chatId) {
  e.preventDefault();
  STATE.selectedContextChatId = chatId;

  const menu = document.getElementById('contextMenu');
  menu.style.top = `${e.clientY}px`;
  menu.style.left = `${e.clientX}px`;
  menu.classList.remove('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Управление прикрепленными файлами ---
function handleFileSelect(file) {
  if (!file) return;

  const reader = new FileReader();

  if (file.type.startsWith('image/')) {
    reader.onload = (e) => {
      STATE.attachedFile = {
        name: file.name,
        type: file.type,
        isImage: true,
        data: e.target.result.split(',')[1] 
      };
      showFilePreview(file.name);
    };
    reader.readAsDataURL(file);
  } else {
    reader.onload = (e) => {
      STATE.attachedFile = {
        name: file.name,
        type: file.type,
        isImage: false,
        content: e.target.result
      };
      showFilePreview(file.name);
    };
    reader.readAsText(file);
  }
}

function showFilePreview(fileName) {
  document.getElementById('attachedFileName').innerText = fileName;
  document.getElementById('attachedFilePreview').classList.remove('hidden');
  showToast(`Файл "${fileName}" прикреплен`, 'info');
}

function removeAttachedFile() {
  STATE.attachedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('attachedFilePreview').classList.add('hidden');
  showToast('Файл удален', 'info');
}

// --- Отправка в Студию ---
function sendToStudio(content) {
  STATE.studioContent = content;
  const studio = document.getElementById('studioSidebar');
  const preview = document.getElementById('studioPreview');

  if (window.marked) {
    preview.innerHTML = marked.parse(content);
  } else {
    preview.innerText = content;
  }

  studio.classList.remove('hidden');
  showToast('Проект отправлен в Студию', 'success');
}

// --- События UI ---
function setupEventListeners() {
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile')?.addEventListener('click', toggleTheme);

  // Боковая панель
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  document.getElementById('burgerBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  document.getElementById('collapseBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  document.getElementById('newChatBtn')?.addEventListener('click', createNewChatState);

  // Выбор модели
  document.querySelectorAll('.model-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.model = chip.dataset.model;
    });
  });

  // Быстрые карточки
  document.querySelectorAll('.quick-cards .card').forEach(card => {
    card.addEventListener('click', () => {
      document.getElementById('promptInput').value = card.dataset.prompt;
      handleSendOrStop();
    });
  });

  // Прикрепление файлов
  const fileInput = document.getElementById('fileInput');
  document.getElementById('attachFileBtn')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
  document.getElementById('removeFileBtn')?.addEventListener('click', removeAttachedFile);

  // Студия
  const studioSidebar = document.getElementById('studioSidebar');
  document.getElementById('toggleStudioBtn')?.addEventListener('click', () => {
    studioSidebar.classList.toggle('hidden');
    
    if (window.innerWidth < 1024) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
  });

  document.getElementById('closeStudioBtn')?.addEventListener('click', () => studioSidebar.classList.add('hidden'));

  document.getElementById('exportProjectBtn')?.addEventListener('click', () => {
    const service = document.getElementById('exportServiceSelect').value;
    if (!STATE.studioContent) {
      showToast('Нет содержимого для экспорта', 'error');
      return;
    }
    showToast(`Проект импортирован в My Work ${service.toUpperCase()}!`, 'success');
  });

  // Генерационные кнопки в Студии
  document.querySelectorAll('.studio-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.activeGenService = btn.dataset.gen;
      const titleMap = {
        document: 'Сгенерировать Документ',
        spreadsheets: 'Сгенерировать Таблицу',
        forms: 'Сгенерировать Форму',
        slides: 'Сгенерировать Слайды',
        keeps: 'Сгенерировать Заметки'
      };
      document.getElementById('studioGenTitle').innerText = titleMap[STATE.activeGenService] || 'Генерация в Студии';
      document.getElementById('studioGenPrompt').value = '';
      document.getElementById('studioGenModal').classList.remove('hidden');
    });
  });

  document.getElementById('closeStudioGenBtn')?.addEventListener('click', () => {
    document.getElementById('studioGenModal').classList.add('hidden');
  });

  document.getElementById('studioSubmitGenBtn')?.addEventListener('click', () => {
    const promptText = document.getElementById('studioGenPrompt').value.trim();
    if (!promptText) return;

    document.getElementById('studioGenModal').classList.add('hidden');
    
    STATE.model = 'agent';
    document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.model-chip[data-model="agent"]')?.classList.add('active');

    const fullPrompt = `[Задача Студии: ${STATE.activeGenService.toUpperCase()}]\n${promptText}`;
    sendMessage(fullPrompt, true);
  });

  // Настройки
  const modal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = STATE.apiKey;
    modal.classList.remove('hidden');
  });

  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    STATE.apiKey = key;
    localStorage.setItem('wg_api_key', key);
    modal.classList.add('hidden');
    showToast('Настройки сохранены', 'success');
    checkApiKeyOnStart();
  });

  // Onboarding Модальное окно
  document.getElementById('saveOnboardingKeyBtn')?.addEventListener('click', () => {
    const key = document.getElementById('onboardingKeyInput').value.trim();
    if (!key) {
      showToast('Введите корректный API Key!', 'error');
      return;
    }
    STATE.apiKey = key;
    localStorage.setItem('wg_api_key', key);
    document.getElementById('onboardingModal').classList.add('hidden');
    showToast('API Key успешно привязан!', 'success');
  });

  // Отправка
  document.getElementById('sendBtn')?.addEventListener('click', () => handleSendOrStop());
  document.getElementById('promptInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendOrStop();
    }
  });
}

function handleSendOrStop() {
  if (STATE.isGenerating) {
    stopGeneration();
  } else {
    sendMessage();
  }
}

async function sendMessage(overrideText = null, isStudioGen = false) {
  const input = document.getElementById('promptInput');
  let text = overrideText || input.value.trim();

  if (!text && STATE.attachedFile) {
    text = "Что изображено на этой картинке?";
  }

  if (!text) return;

  if (STATE.limit <= 0) {
    showToast('Лимит исчерпан. Дождитесь сброса.', 'error');
    return;
  }

  STATE.lastPrompt = text;
  
  const fileToSend = STATE.attachedFile;

  if (!overrideText) {
    input.value = '';
    removeAttachedFile();
  }

  if (!STATE.activeChatId) {
    const newChat = {
      id: 'chat_' + Date.now(),
      title: text.length > 22 ? text.substring(0, 22) + '...' : text,
      messages: []
    };
    STATE.chats.unshift(newChat);
    STATE.activeChatId = newChat.id;
    saveChats();
    renderChatList();
  }

  document.getElementById('chatWelcome').classList.add('hidden');
  document.getElementById('chatMessages').classList.remove('hidden');

  const userMsgText = fileToSend ? `[Файл: ${fileToSend.name}]\n${text}` : text;
  appendMessage(userMsgText, 'user');

  // Логика режима Plan (быстрое планирование)
  if (STATE.model === 'plan') {
    consumeLimit(2);
    setGenerationState(true);
    STATE.abortController = new AbortController();

    try {
      const planResponse = await fetchGeminiResponse(text, fileToSend, STATE.abortController.signal, true);
      appendMessage(`📋 **План выполнения задачи:**\n\n${planResponse}\n\n---\n💡 *Переключитесь на **⚡ Agent**, чтобы реализовать этот план.*`, 'ai');
    } catch (err) {
      consumeLimit(-2);
      if (err.name === 'AbortError') {
        appendStoppedUI(text);
      } else {
        appendErrorUI(err.message, text);
        showToast('Не удалось получить план', 'error');
      }
    } finally {
      setGenerationState(false);
    }
    return;
  }

  // Логика режима Agent (полная генерация)
  consumeLimit(10);
  setGenerationState(true);

  STATE.abortController = new AbortController();

  try {
    const responseText = await fetchGeminiResponse(text, fileToSend, STATE.abortController.signal, false);
    appendMessage(responseText, 'ai');

    if (isStudioGen) {
      sendToStudio(responseText);
    }
  } catch (err) {
    consumeLimit(-10);

    if (err.name === 'AbortError') {
      appendStoppedUI(text);
    } else {
      appendErrorUI(err.message, text);
      showToast('Не удалось получить ответ', 'error');
    }
  } finally {
    setGenerationState(false);
  }
}

function stopGeneration() {
  if (STATE.abortController) {
    STATE.abortController.abort();
  }
}

function appendErrorUI(errorMessage, originalPrompt) {
  const container = document.getElementById('chatMessages');

  const errorBox = document.createElement('div');
  errorBox.className = 'stopped-action-box error-action-box';
  errorBox.innerHTML = `
    <div class="stopped-title">
      <span class="material-symbols-rounded">error_outline</span>
      <span>${escapeHtml(errorMessage)}</span>
    </div>
    <div class="stopped-btns">
      <button class="secondary-btn retry-btn ripple">
        <span class="material-symbols-rounded">refresh</span>
        Повторить попытку
      </button>
    </div>
  `;

  errorBox.querySelector('.retry-btn').addEventListener('click', () => {
    errorBox.remove();
    sendMessage(originalPrompt);
  });

  container.appendChild(errorBox);
  container.scrollTop = container.scrollHeight;
}

function setGenerationState(isGenerating) {
  STATE.isGenerating = isGenerating;
  const sendBtn = document.getElementById('sendBtn');
  const thinkingBlock = document.getElementById('thinkingBlock');

  if (isGenerating) {
    sendBtn.classList.add('stop-mode');
    sendBtn.title = 'Остановить запрос';
    sendBtn.innerHTML = '<span class="material-symbols-rounded">stop</span><span>Остановить</span>';
    thinkingBlock.classList.remove('hidden');
  } else {
    sendBtn.classList.remove('stop-mode');
    sendBtn.title = 'Отправить';
    sendBtn.innerHTML = '<span class="material-symbols-rounded" id="sendBtnIcon">arrow_upward</span>';
    thinkingBlock.classList.add('hidden');
  }
}

function appendStoppedUI(originalPrompt) {
  const container = document.getElementById('chatMessages');

  const actionBox = document.createElement('div');
  actionBox.className = 'stopped-action-box';
  actionBox.innerHTML = `
    <div class="stopped-title">
      <span class="material-symbols-rounded">block</span>
      <span>Вы остановили генерацию</span>
    </div>
    <div class="stopped-btns">
      <button class="secondary-btn retry-btn ripple">Retry</button>
      <button class="secondary-btn edit-btn ripple">Изменить запрос</button>
    </div>
  `;

  actionBox.querySelector('.retry-btn').addEventListener('click', () => {
    actionBox.remove();
    sendMessage(originalPrompt);
  });

  actionBox.querySelector('.edit-btn').addEventListener('click', () => {
    document.getElementById('promptInput').value = originalPrompt;
    actionBox.remove();
  });

  container.appendChild(actionBox);
  container.scrollTop = container.scrollHeight;
}

// --- Запрос к API ---
async function fetchGeminiResponse(userPrompt, fileData, signal, isPlanMode = false) {
  const apiKey = STATE.apiKey;
  if (!apiKey) {
    checkApiKeyOnStart();
    throw new Error('Отсутствует Google API Key.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  const parts = [];

  if (fileData && fileData.isImage) {
    parts.push({
      inline_data: {
        mime_type: fileData.type,
        data: fileData.data
      }
    });
  }

  const currentSystemPrompt = isPlanMode ? PLAN_SYSTEM_PROMPT : SYSTEM_PROMPT;
  let textPayload = `${currentSystemPrompt}\n\nЗапрос пользователя:\n${userPrompt}`;
  
  if (fileData && !fileData.isImage) {
    textPayload = `[Содержимое файла ${fileData.name}]:\n${fileData.content}\n\n` + textPayload;
  }

  parts.push({ text: textPayload });

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: isPlanMode ? 300 : 2048,
      temperature: isPlanMode ? 0.2 : 0.7
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new Error('Сервера Google перегружены или превышен размер запроса (429).');
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error('Неверный API-ключ или нет доступа.');
    }
    throw new Error(errData.error?.message || `Ошибка HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Пустой ответ от модели.';
}

function appendMessage(text, sender, save = true) {
  const container = document.getElementById('chatMessages');
  const msgEl = document.createElement('div');
  msgEl.className = `message ${sender}`;
  
  if (sender === 'ai' && window.marked) {
    msgEl.innerHTML = marked.parse(text);
  } else {
    msgEl.innerText = text;
  }

  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;

  if (save && STATE.activeChatId) {
    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (chat) {
      chat.messages.push({ text, sender });
      saveChats();
    }
  }
}

// --- Вспомогательные окна ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info';

  toast.innerHTML = `
    <span class="material-symbols-rounded toast-icon">${iconName}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3500);
}

function showCustomDialog({ title = 'Подтверждение', message = '', isInput = false, defaultValue = '', danger = false }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customDialogModal');
    const titleEl = document.getElementById('dialogTitle');
    const msgEl = document.getElementById('dialogMessage');
    const inputEl = document.getElementById('dialogInput');
    const okBtn = document.getElementById('dialogOkBtn');
    const cancelBtn = document.getElementById('dialogCancelBtn');
    const iconEl = document.getElementById('dialogIcon');

    titleEl.innerText = title;
    msgEl.innerText = message;
    
    if (isInput) {
      inputEl.classList.remove('hidden');
      inputEl.value = defaultValue;
    } else {
      inputEl.classList.add('hidden');
      inputEl.value = '';
    }

    if (danger) {
      okBtn.style.background = 'var(--stop-red)';
      iconEl.style.color = 'var(--stop-red)';
      iconEl.innerText = 'warning';
    } else {
      okBtn.style.background = 'var(--accent)';
      iconEl.style.color = 'var(--accent)';
      iconEl.innerText = isInput ? 'edit' : 'help_outline';
    }

    modal.classList.remove('hidden');
    if (isInput) setTimeout(() => inputEl.focus(), 100);

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onOk = () => {
      cleanup();
      resolve(isInput ? inputEl.value.trim() : true);
    };

    const onCancel = () => {
      cleanup();
      resolve(isInput ? null : false);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}
