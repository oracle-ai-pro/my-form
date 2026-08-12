/* ==========================================================================
   ИНИЦИАЛИЗАЦИЯ И СОСТОЯНИЕ ПРИЛОЖЕНИЯ
   ========================================================================== */
const DEFAULT_DECKS = [
    {
        id: 'deck-1',
        title: 'Введение в проект',
        slides: [
            {
                type: 'title-slide',
                title: 'Добро пожаловать в Prestige HQ',
                subtitle: 'Интерактивная система презентаций и слайдов',
                notes: 'Приветствуйте аудиторию, представьтесь.'
            },
            {
                type: 'content',
                title: 'Основные возможности',
                bullets: 'Поддержка нескольких макетов слайдов\nВстроенный ИИ-генератор и чат\nПоддержка заметки докладчика\nЭкспорт и импорт в JSON',
                notes: 'Расскажите кратко о каждом пункте.'
            },
            {
                type: 'quote',
                title: 'Простота — залог успеха',
                subtitle: 'Лучший дизайн тот, в котором нет ничего лишнего.',
                quoteAuthor: 'Дизайн-команда Prestige',
                notes: 'Сделайте паузу для осмысления цитаты.'
            }
        ]
    }
];

let decks = JSON.parse(localStorage.getItem('prestige_decks')) || DEFAULT_DECKS;
let currentDeckId = localStorage.getItem('prestige_current_deck_id') || decks[0].id;
let currentSlideIndex = 0;
let isAdminLoggedIn = false;
let editingSlideIndex = null;
let currentMediaData = '';
let customPromptCallback = null;
let contextMenuDeckId = null;
let confirmModalCallback = null;

// ТАЙМЕР И РЕЖИМ ДОКЛАДЧИКА
let presenterTimerInterval = null;
let presenterSeconds = 0;
let isTimerPaused = false;
let presenterNotesFontSize = 16;
let currentMuteMode = null; // 'black', 'white' или null

/* ==========================================================================
   СОБЫТИЕ ЗАГРУЗКИ СТРАНИЦЫ И ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const urlParams = new URLSearchParams(window.location.search);
    const deckIdFromUrl = urlParams.get('deckId');

    if (deckIdFromUrl) {
        const deckExists = decks.find(d => d.id === deckIdFromUrl);
        if (deckExists) {
            currentDeckId = deckIdFromUrl;
        }
    }

    renderTabsAndSelect();
    renderSlide();
    initSlideTouchAndClick();
    initPresentationContextMenu();

    // Закрытие выпадающего меню инструментов при клике снаружи
    document.addEventListener('click', (e) => {
        const dropdown = document.querySelector('.tools-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            const toolsMenu = document.getElementById('tools-menu');
            if (toolsMenu) toolsMenu.classList.add('hidden');
        }
    });

    // Клавиатурная навигация и горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        
        // Горячие клавиши для A/V Mute (B = Black, W = White)
        if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
            toggleScreenMute('black');
            return;
        }
        if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
            toggleScreenMute('white');
            return;
        }

        // Выход из затемнения экрана по Esc или любой клавише
        if (currentMuteMode !== null) {
            toggleScreenMute(null);
            return;
        }

        // Переключение слайдов
        if (e.key === 'ArrowRight' || e.key === 'Space' || e.key === 'PageDown') {
            e.preventDefault();
            nextSlide();
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            prevSlide();
        }
    });

    // Обновление часов в режиме докладчика
    setInterval(updatePresenterClock, 1000);
});

document.addEventListener('click', hideTabContextMenu);
document.addEventListener('scroll', hideTabContextMenu, true);

/* ==========================================================================
   УПРАВЛЕНИЕ ТЕМОЙ И ИНТЕРФЕЙСОМ
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('prestige_theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('prestige_theme', theme);
}

function toggleToolsMenu() {
    const menu = document.getElementById('tools-menu');
    if (menu) menu.classList.toggle('hidden');
}

function toggleSpeakerNotes() {
    const box = document.getElementById('speaker-notes-box');
    if (box) box.classList.toggle('hidden');
}

function toggleDeckLayout(isCompact) {
    const select = document.getElementById('slides-tabs-select');
    const tabsList = document.getElementById('slides-tabs-list');
    if (isCompact) {
        select.classList.remove('hidden');
        tabsList.classList.add('hidden');
    } else {
        select.classList.add('hidden');
        tabsList.classList.remove('hidden');
    }
}

/* ==========================================================================
   ТАПЫ И СВАЙПЫ ДЛЯ МОБИЛЬНЫХ И ПК
   ========================================================================== */
function initSlideTouchAndClick() {
    const slideBox = document.getElementById('slide-box');
    if (!slideBox) return;

    let touchStartX = 0;
    let touchStartY = 0;

    slideBox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    slideBox.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Порог свайпа по горизонтали
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
            if (diffX < 0) nextSlide();
            else prevSlide();
        }
    }, { passive: true });

    // Тап по левой / правой стороне экрана
    slideBox.addEventListener('click', (e) => {
        // Игнорируем клик по интерактивным элементам (кнопки, ссылки, видео)
        if (e.target.closest('button, a, input, textarea, select, video, .tools-icon-btn, .slide-context-menu')) return;

        const rect = slideBox.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        if (clickX < rect.width * 0.4) {
            prevSlide();
        } else {
            nextSlide();
        }
    });
}

/* ==========================================================================
   КОНТЕКСТНОЕ МЕНЮ ПРЕЗЕНТАЦИИ (ПО ПКМ ВО ВРЕМЯ ПОКАЗА)
   ========================================================================== */
function initPresentationContextMenu() {
    const presentationScreen = document.getElementById('presentation-screen');
    if (!presentationScreen) return;

    presentationScreen.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showPresentationContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener('click', hidePresentationContextMenu);
}

function showPresentationContextMenu(x, y) {
    let menu = document.getElementById('presentation-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'presentation-context-menu';
        menu.className = 'slide-context-menu hidden';
        document.body.appendChild(menu);
    }

    menu.innerHTML = `
        <div class="slide-context-item" onclick="nextSlide()"><span class="material-symbols-rounded">navigate_next</span> Следующий</div>
        <div class="slide-context-item" onclick="prevSlide()"><span class="material-symbols-rounded">navigate_before</span> Предыдущий</div>
        <div class="slide-context-divider"></div>
        <div class="slide-context-item" onclick="openSlideGridModal()"><span class="material-symbols-rounded">grid_view</span> Просмотр всех слайдов</div>
        <div class="slide-context-item" onclick="openPresenterMode()"><span class="material-symbols-rounded">badge</span> Показать режим докладчика</div>
        <div class="slide-context-divider"></div>
        <div class="slide-context-item" onclick="toggleScreenMute('black')"><span class="material-symbols-rounded">desktop_access_disabled</span> Черный экран (B)</div>
        <div class="slide-context-item" onclick="toggleScreenMute('white')"><span class="material-symbols-rounded">light_mode</span> Белый экран (W)</div>
        <div class="slide-context-divider"></div>
        <div class="slide-context-item danger" onclick="exitFullscreenPresentation()"><span class="material-symbols-rounded">close</span> Завершить показ слайдов</div>
    `;

    menu.style.top = `${y}px`;
    menu.style.left = `${x}px`;
    menu.classList.remove('hidden');
}

function hidePresentationContextMenu() {
    const menu = document.getElementById('presentation-context-menu');
    if (menu) menu.classList.add('hidden');
}

/* ==========================================================================
   A/V MUTE (ЧЕРНЫЙ / БЕЛЫЙ ЭКРАН)
   ========================================================================== */
function toggleScreenMute(mode) {
    const overlay = document.getElementById('screen-mute-overlay');
    if (!overlay) return;

    if (mode === null || (currentMuteMode === mode && !overlay.classList.contains('hidden'))) {
        overlay.classList.add('hidden');
        overlay.className = 'screen-mute-overlay hidden';
        currentMuteMode = null;
    } else {
        currentMuteMode = mode;
        overlay.className = `screen-mute-overlay active ${mode}`;
        overlay.classList.remove('hidden');
    }
}

/* ==========================================================================
   ПЕРЕКЛЮЧЕНИЕ ПРЕЗЕНТАЦИЙ И ВКЛАДОК
   ========================================================================== */
function saveDecks() {
    localStorage.setItem('prestige_decks', JSON.stringify(decks));
    localStorage.setItem('prestige_current_deck_id', currentDeckId);
}

function getCurrentDeck() {
    return decks.find(d => d.id === currentDeckId) || decks[0];
}

function renderTabsAndSelect() {
    const tabsList = document.getElementById('slides-tabs-list');
    const select = document.getElementById('slides-tabs-select');
    
    if (!tabsList || !select) return;

    tabsList.innerHTML = '';
    select.innerHTML = '';

    decks.forEach(deck => {
        const tab = document.createElement('button');
        tab.className = `tab-btn ${deck.id === currentDeckId ? 'active' : ''}`;
        tab.innerText = deck.title;
        tab.onclick = () => switchDeck(deck.id);
        tab.oncontextmenu = (e) => showTabContextMenu(e, deck.id);

        tabsList.appendChild(tab);

        const option = document.createElement('option');
        option.value = deck.id;
        option.innerText = deck.title;
        if (deck.id === currentDeckId) option.selected = true;
        select.appendChild(option);
    });
}

function switchDeck(id) {
    currentDeckId = id;
    currentSlideIndex = 0;
    saveDecks();
    renderTabsAndSelect();
    renderSlide();
    if (isAdminLoggedIn) renderAdminSlidesList();
}

function switchDeckFromSelect(id) {
    switchDeck(id);
}

function createNewDeckPrompt() {
    showPrompt('Создать презентацию', 'Введите название новой презентации:', (title) => {
        if (!title || !title.trim()) return;
        const newDeck = {
            id: 'deck-' + Date.now(),
            title: title.trim(),
            slides: [{ type: 'title-slide', title: title.trim(), subtitle: 'Новая презентация' }]
        };
        decks.push(newDeck);
        switchDeck(newDeck.id);
    });
}

/* ==========================================================================
   ОТРИСОВКА И НАВИГАЦИЯ ПО СЛАЙДАМ
   ========================================================================== */
function generateSlideHTML(slide) {
    if (!slide) return '<div style="text-align:center;">Пустой слайд</div>';

    switch (slide.type) {
        case 'title-slide':
            return `
                <div class="slide-title-layout">
                    <h1>${escapeHtml(slide.title || '')}</h1>
                    <p>${escapeHtml(slide.subtitle || '')}</p>
                </div>`;

        case 'content':
            const bulletsArr = (slide.bullets || '').split('\n').filter(b => b.trim());
            const bulletsHtml = bulletsArr.map(b => `<li>${escapeHtml(b)}</li>`).join('');
            return `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    ${slide.subtitle ? `<p style="color:var(--text-muted); margin-bottom:12px;">${escapeHtml(slide.subtitle)}</p>` : ''}
                    <ul class="slide-bullets">${bulletsHtml}</ul>
                </div>`;

        case 'two-column':
            return `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    <div class="slide-two-col">
                        <div>${escapeHtml(slide.bullets || '').replace(/\n/g, '<br>')}</div>
                        <div>${escapeHtml(slide.col2 || '').replace(/\n/g, '<br>')}</div>
                    </div>
                </div>`;

        case 'quote':
            return `
                <div class="slide-quote-layout">
                    <blockquote>“${escapeHtml(slide.title || slide.subtitle || '')}”</blockquote>
                    ${slide.quoteAuthor ? `<div class="slide-quote-author">— ${escapeHtml(slide.quoteAuthor)}</div>` : ''}
                </div>`;

        case 'media':
            const mediaUrl = slide.mediaUrl || currentMediaData;
            let mediaHtml = '';
            if (mediaUrl) {
                if (mediaUrl.startsWith('data:video') || mediaUrl.endsWith('.mp4')) {
                    mediaHtml = `<video src="${mediaUrl}" controls></video>`;
                } else {
                    mediaHtml = `<img src="${mediaUrl}" alt="Slide Media">`;
                }
            }
            return `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    <p>${escapeHtml(slide.subtitle || '')}</p>
                    <div class="slide-media-container">${mediaHtml}</div>
                </div>`;

        case 'code':
            return `
                <div class="slide-content-layout">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    <pre class="slide-code-block"><code>${escapeHtml(slide.bullets || '')}</code></pre>
                </div>`;

        default:
            return `<h3>${escapeHtml(slide.title || '')}</h3><p>${escapeHtml(slide.subtitle || '')}</p>`;
    }
}

function renderSlide() {
    const deck = getCurrentDeck();
    const slides = deck ? deck.slides || [] : [];
    const body = document.getElementById('slide-body');
    
    if (!body) return;

    if (slides.length === 0) {
        body.innerHTML = '<div style="text-align:center;">Презентация пуста</div>';
        return;
    }

    if (currentSlideIndex >= slides.length) currentSlideIndex = slides.length - 1;
    if (currentSlideIndex < 0) currentSlideIndex = 0;

    const slide = slides[currentSlideIndex];
    
    const curNum = document.getElementById('current-slide-number');
    const totNum = document.getElementById('total-slides-number');
    const progress = document.getElementById('progress');
    const speakerText = document.getElementById('speaker-notes-text');

    if (curNum) curNum.innerText = currentSlideIndex + 1;
    if (totNum) totNum.innerText = slides.length;
    if (progress) progress.style.width = `${((currentSlideIndex + 1) / slides.length) * 100}%`;
    if (speakerText) speakerText.innerText = slide.notes || 'Нет заметок к этому слайду.';

    body.innerHTML = generateSlideHTML(slide);

    // Если открыт режим докладчика — обновляем и его
    updatePresenterModeUI();
}

function nextSlide() {
    const deck = getCurrentDeck();
    if (deck && currentSlideIndex < deck.slides.length - 1) {
        currentSlideIndex++;
        renderSlide();
    }
}

function prevSlide() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        renderSlide();
    }
}

function goToSlide(index) {
    const deck = getCurrentDeck();
    if (deck && index >= 0 && index < deck.slides.length) {
        currentSlideIndex = index;
        renderSlide();
        closeSlideGridModal();
    }
}

function startFullscreenPresentation() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
}

function exitFullscreenPresentation() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

/* ==========================================================================
   РЕЖИМ ДОКЛАДЧИКА (PRESENTER VIEW)
   ========================================================================== */
function openPresenterMode() {
    const modal = document.getElementById('presenter-view-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    startPresenterTimer();
    updatePresenterModeUI();
}

function closePresenterMode() {
    const modal = document.getElementById('presenter-view-modal');
    if (modal) modal.classList.add('hidden');
    if (presenterTimerInterval) clearInterval(presenterTimerInterval);
}

function updatePresenterModeUI() {
    const modal = document.getElementById('presenter-view-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    const deck = getCurrentDeck();
    const slides = deck ? deck.slides || [] : [];
    if (slides.length === 0) return;

    const currentSlide = slides[currentSlideIndex];
    const nextSlide = slides[currentSlideIndex + 1];

    // Отрисовка текущего слайда
    const curBody = document.getElementById('presenter-current-slide-body');
    if (curBody) curBody.innerHTML = generateSlideHTML(currentSlide);

    // Отрисовка превью следующего слайда
    const nextBody = document.getElementById('presenter-next-slide-body');
    if (nextBody) {
        if (nextSlide) {
            nextBody.innerHTML = generateSlideHTML(nextSlide);
        } else {
            nextBody.innerHTML = '<div style="text-align:center; padding-top:40px; color:#888;">Конец презентации</div>';
        }
    }

    // Заметки
    const notesText = document.getElementById('presenter-notes-text');
    if (notesText) {
        notesText.innerText = currentSlide.notes || 'Щелкните, чтобы добавить заметки';
        notesText.style.fontSize = `${presenterNotesFontSize}px`;
    }

    // Счетчики
    const curNum = document.getElementById('presenter-cur-num');
    const totNum = document.getElementById('presenter-tot-num');
    const prevBtn = document.getElementById('presenter-prev-btn');
    const nextBtn = document.getElementById('presenter-next-btn');

    if (curNum) curNum.innerText = currentSlideIndex + 1;
    if (totNum) totNum.innerText = slides.length;
    if (prevBtn) prevBtn.disabled = currentSlideIndex === 0;
    if (nextBtn) nextBtn.disabled = currentSlideIndex === slides.length - 1;
}

function startPresenterTimer() {
    if (presenterTimerInterval) clearInterval(presenterTimerInterval);
    presenterTimerInterval = setInterval(() => {
        if (!isTimerPaused) {
            presenterSeconds++;
            const display = document.getElementById('presenter-timer-display');
            if (display) {
                const h = Math.floor(presenterSeconds / 3600);
                const m = Math.floor((presenterSeconds % 3600) / 60);
                const s = presenterSeconds % 60;
                display.innerText = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
        }
    }, 1000);
}

function togglePresenterTimer() {
    isTimerPaused = !isTimerPaused;
    const btn = document.getElementById('presenter-pause-btn');
    if (btn) btn.innerHTML = isTimerPaused ? '<span class="material-symbols-rounded">play_arrow</span>' : '<span class="material-symbols-rounded">pause</span>';
}

function resetPresenterTimer() {
    presenterSeconds = 0;
    const display = document.getElementById('presenter-timer-display');
    if (display) display.innerText = '0:00:00';
}

function updatePresenterClock() {
    const clock = document.getElementById('presenter-clock-display');
    if (clock) {
        const now = new Date();
        clock.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

function changePresenterNotesFont(delta) {
    presenterNotesFontSize = Math.max(12, Math.min(32, presenterNotesFontSize + delta));
    const notesText = document.getElementById('presenter-notes-text');
    if (notesText) notesText.style.fontSize = `${presenterNotesFontSize}px`;
}

/* ==========================================================================
   СЕТКА ВСЕХ СЛАЙДОВ (SLIDE GRID MODAL)
   ========================================================================== */
function openSlideGridModal() {
    const modal = document.getElementById('slide-grid-modal');
    const container = document.getElementById('slide-grid-container');
    const deck = getCurrentDeck();

    if (!modal || !container || !deck) return;

    container.innerHTML = '';
    deck.slides.forEach((slide, idx) => {
        const card = document.createElement('div');
        card.className = `slide-grid-item ${idx === currentSlideIndex ? 'active' : ''}`;
        card.onclick = () => goToSlide(idx);
        card.innerHTML = `
            <div class="slide-grid-preview">${generateSlideHTML(slide)}</div>
            <div class="slide-grid-number">${idx + 1}</div>
        `;
        container.appendChild(card);
    });

    modal.classList.add('active');
}

function closeSlideGridModal() {
    const modal = document.getElementById('slide-grid-modal');
    if (modal) modal.classList.remove('active');
}

/* ==========================================================================
   АДМИНИСТРИРОВАНИЕ И РЕДАКТИРОВАНИЕ
   ========================================================================== */
function openLoginModal() {
    if (isAdminLoggedIn) {
        showAdminPanel();
    } else {
        document.getElementById('login-modal').classList.add('active');
    }
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
}

function tryLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (user === 'admin' && pass === '1234') {
        isAdminLoggedIn = true;
        closeLoginModal();
        showAdminPanel();
        showAlert('Успешно', 'Вы вошли в панель администратора!');
    } else {
        showAlert('Ошибка', 'Неверный логин или пароль!');
    }
}

function showAdminPanel() {
    document.getElementById('presentation-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.remove('hidden');
    renderAdminSlidesList();
}

function logout() {
    isAdminLoggedIn = false;
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('presentation-screen').classList.remove('hidden');
}

function toggleAddSlideForm() {
    const form = document.getElementById('admin-add-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
        resetAdminForm();
    }
}

function toggleAdminSlideFields() {
    const type = document.getElementById('new-slide-type').value;
    const col2Box = document.getElementById('admin-second-column-box');
    const quoteBox = document.getElementById('admin-quote-author-box');
    const mediaBox = document.getElementById('media-upload-box');

    col2Box.classList.add('hidden');
    quoteBox.classList.add('hidden');
    mediaBox.classList.add('hidden');

    if (type === 'two-column') col2Box.classList.remove('hidden');
    if (type === 'quote') quoteBox.classList.remove('hidden');
    if (type === 'media') mediaBox.classList.remove('hidden');
}

function handleMediaUploadPreview(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentMediaData = e.target.result;
            document.getElementById('media-preview-container').innerHTML = 
                `<img src="${currentMediaData}" style="max-height:100px; margin-top:8px; border-radius:6px;">`;
        };
        reader.readAsDataURL(file);
    }
}

function addSlide() {
    const deck = getCurrentDeck();
    const type = document.getElementById('new-slide-type').value;
    const title = document.getElementById('new-slide-title').value;
    const subtitle = document.getElementById('new-slide-subtitle').value;
    const bullets = document.getElementById('new-slide-bullets').value;
    const col2 = document.getElementById('new-slide-col2').value;
    const quoteAuthor = document.getElementById('new-quote-author').value;
    const mediaUrl = document.getElementById('new-media-url').value || currentMediaData;
    const notes = document.getElementById('new-speaker-notes').value;

    const newSlideData = { type, title, subtitle, bullets, col2, quoteAuthor, mediaUrl, notes };

    if (editingSlideIndex !== null) {
        deck.slides[editingSlideIndex] = newSlideData;
        editingSlideIndex = null;
    } else {
        deck.slides.push(newSlideData);
    }

    saveDecks();
    renderAdminSlidesList();
    renderSlide();
    resetAdminForm();
    document.getElementById('admin-add-form').classList.add('hidden');
}

function resetAdminForm() {
    document.getElementById('admin-form-title').innerText = 'Новый слайд';
    document.getElementById('new-slide-title').value = '';
    document.getElementById('new-slide-subtitle').value = '';
    document.getElementById('new-slide-bullets').value = '';
    document.getElementById('new-slide-col2').value = '';
    document.getElementById('new-quote-author').value = '';
    document.getElementById('new-media-url').value = '';
    document.getElementById('new-speaker-notes').value = '';
    document.getElementById('media-preview-container').innerHTML = '';
    currentMediaData = '';
    editingSlideIndex = null;
    document.getElementById('cancel-edit-btn').classList.add('hidden');
}

function renderAdminSlidesList() {
    const list = document.getElementById('admin-slides-list');
    const deck = getCurrentDeck();
    if (!list || !deck) return;

    list.innerHTML = '';

    deck.slides.forEach((slide, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-slide-item';
        item.innerHTML = `
            <div>
                <strong>${idx + 1}. ${escapeHtml(slide.title || 'Без названия')}</strong> 
                <span style="font-size:12px; color:var(--text-muted);">(${slide.type})</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="tools-icon-btn" onclick="editSlide(${idx})" title="Редактировать"><span class="material-symbols-rounded">edit</span></button>
                <button class="tools-icon-btn" onclick="deleteSlide(${idx})" title="Удалить"><span class="material-symbols-rounded">delete</span></button>
            </div>
        `;
        list.appendChild(item);
    });
}

function editSlide(idx) {
    const deck = getCurrentDeck();
    const slide = deck.slides[idx];
    editingSlideIndex = idx;

    document.getElementById('admin-form-title').innerText = `Редактирование слайда №${idx + 1}`;
    document.getElementById('new-slide-type').value = slide.type;
    document.getElementById('new-slide-title').value = slide.title || '';
    document.getElementById('new-slide-subtitle').value = slide.subtitle || '';
    document.getElementById('new-slide-bullets').value = slide.bullets || '';
    document.getElementById('new-slide-col2').value = slide.col2 || '';
    document.getElementById('new-quote-author').value = slide.quoteAuthor || '';
    document.getElementById('new-media-url').value = slide.mediaUrl || '';
    document.getElementById('new-speaker-notes').value = slide.notes || '';

    toggleAdminSlideFields();
    document.getElementById('admin-add-form').classList.remove('hidden');
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
}

function cancelEditSlide() {
    resetAdminForm();
    document.getElementById('admin-add-form').classList.add('hidden');
}

function deleteSlide(idx) {
    const deck = getCurrentDeck();
    if (confirm('Вы уверены, что хотите удалить этот слайд?')) {
        deck.slides.splice(idx, 1);
        saveDecks();
        renderAdminSlidesList();
        renderSlide();
    }
}

/* ==========================================================================
   ИМПОРТ / ЭКСПОРТ, ПЕЧАТЬ И ШЕРИНГ
   ========================================================================== */
function exportDeckToJSON() {
    const deck = getCurrentDeck();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(deck, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${deck.title.toLowerCase().replace(/\s+/g, '_')}_presentation.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importDeckFromJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedDeck = JSON.parse(e.target.result);
            if (importedDeck && importedDeck.slides) {
                importedDeck.id = 'deck-' + Date.now();
                decks.push(importedDeck);
                switchDeck(importedDeck.id);
                showAlert('Успех', 'Презентация успешно импортирована!');
            } else {
                showAlert('Ошибка', 'Некорректный формат файла JSON.');
            }
        } catch (err) {
            showAlert('Ошибка', 'Ошибка чтения файла.');
        }
    };
    reader.readAsText(file);
}

function generateShareLink() {
    const deck = getCurrentDeck();
    if (!deck) return;

    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('deckId', deck.id);

    navigator.clipboard.writeText(shareUrl.toString()).then(() => {
        showAlert(
            'Ссылка скопирована! 🔗', 
            `Прямая ссылка на «${escapeHtml(deck.title)}» скопирована в буфер обмена:\n\n${shareUrl.toString()}`
        );
    }).catch(err => {
        showPrompt('Скопируйте ссылку вручную:', shareUrl.toString(), () => {});
        const promptInput = document.getElementById('custom-prompt-input');
        if (promptInput) promptInput.value = shareUrl.toString();
    });
}

function printCurrentDeck() {
    const deck = getCurrentDeck();
    if (!deck || !deck.slides || deck.slides.length === 0) {
        showAlert('Ошибка', 'Нет слайдов для печати.');
        return;
    }

    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
        showAlert('Ошибка', 'Запрещены всплывающие окна! Разрешите их для печати.');
        return;
    }

    const slidesHtml = deck.slides.map((slide, index) => {
        let contentHtml = generateSlideHTML(slide);

        return `
            <div class="print-page">
                <div class="slide-footer">Слайд ${index + 1} из ${deck.slides.length}</div>
                ${contentHtml}
            </div>
        `;
    }).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Печать: ${escapeHtml(deck.title)}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: system-ui, -apple-system, sans-serif;
                    background: #ffffff;
                    color: #000000;
                }
                .print-page {
                    padding: 40px;
                    min-height: 100vh;
                    position: relative;
                    page-break-after: always;
                    border-bottom: 1px dashed #ccc;
                }
                .slide-footer {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    font-size: 12px;
                    color: #888;
                }
                @media print {
                    .print-page {
                        border-bottom: none;
                        height: 100vh;
                        page-break-after: always;
                    }
                }
            </style>
        </head>
        <body>
            ${slidesHtml}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
    }, 300);
}

/* ==========================================================================
   ОБРАБОТКА ПКМ ПО ВКЛАДКАМ И МОДАЛЬНЫЕ ОКНА
   ========================================================================== */
function showTabContextMenu(e, deckId) {
    e.preventDefault();
    contextMenuDeckId = deckId;

    let menu = document.getElementById('tab-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'tab-context-menu';
        menu.className = 'context-menu hidden';
        document.body.appendChild(menu);
    }

    menu.innerHTML = `
        <div class="context-menu-item" onclick="renameDeckFromContext()">
            <span class="material-symbols-rounded">edit</span> Изменить название
        </div>
        <div class="context-menu-item" onclick="editDeckPurposeFromContext()">
            <span class="material-symbols-rounded">psychology</span> Смысл слайдов
        </div>
        <div class="context-menu-item danger" onclick="deleteDeckFromContext()">
            <span class="material-symbols-rounded">delete</span> Удалить
        </div>
    `;

    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.classList.remove('hidden');
}

function hideTabContextMenu() {
    const menu = document.getElementById('tab-context-menu');
    if (menu) menu.classList.add('hidden');
}

function renameDeckFromContext() {
    hideTabContextMenu();
    const deck = decks.find(d => d.id === contextMenuDeckId);
    if (!deck) return;

    showPrompt('Изменить название', 'Введите новое название презентации:', (newTitle) => {
        if (newTitle && newTitle.trim()) {
            deck.title = newTitle.trim();
            saveDecks();
            renderTabsAndSelect();
        }
    });
}

function editDeckPurposeFromContext() {
    hideTabContextMenu();
    const deck = decks.find(d => d.id === contextMenuDeckId);
    if (!deck) return;

    showPrompt(
        'Смысл слайдов', 
        'Опишите главную цель и суть этой презентации:', 
        (purpose) => {
            if (purpose !== null) {
                deck.purpose = purpose.trim();
                saveDecks();
                showAlert('Смысл сохранен', deck.purpose ? `Суть презентации: "${deck.purpose}"` : 'Описание очищено.');
            }
        }
    );

    const promptInput = document.getElementById('custom-prompt-input');
    if (promptInput && deck.purpose) {
        promptInput.value = deck.purpose;
    }
}

function deleteDeckFromContext() {
    hideTabContextMenu();
    const deckToDelete = decks.find(d => d.id === contextMenuDeckId);
    if (!deckToDelete) return;

    if (decks.length <= 1) {
        showAlert('Внимание', 'Нельзя удалить единственную презентацию!');
        return;
    }

    showConfirmModal(
        '⚠️ Удаление презентации',
        `Вы уверены, что хотите безвозвратно удалить "${escapeHtml(deckToDelete.title)}"?`,
        () => {
            decks = decks.filter(d => d.id !== contextMenuDeckId);
            if (currentDeckId === contextMenuDeckId) {
                currentDeckId = decks[0].id;
            }
            saveDecks();
            renderTabsAndSelect();
            renderSlide();
            if (isAdminLoggedIn) renderAdminSlidesList();
            showAlert('Удалено', 'Презентация была успешно удалена.');
        }
    );
}

function showConfirmModal(title, text, onConfirm) {
    let modal = document.getElementById('confirm-danger-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirm-danger-modal';
        modal.className = 'custom-alert-overlay';
        modal.innerHTML = `
            <div class="custom-alert-card">
                <h3 id="confirm-modal-title" style="margin-bottom:12px; color:#ef4444; font-size:18px;"></h3>
                <p id="confirm-modal-text" style="margin-bottom:20px; font-size:14px; color:var(--text-muted);"></p>
                <div style="display:flex; justify-content:center; gap:10px;">
                    <button class="btn" style="background:var(--border-color); color:var(--text-color);" onclick="closeConfirmModal(false)">Отмена</button>
                    <button class="btn" style="background:#ef4444;" onclick="closeConfirmModal(true)">Удалить</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-text').innerText = text;
    confirmModalCallback = onConfirm;
    modal.classList.add('active');
}

function closeConfirmModal(isConfirmed) {
    const modal = document.getElementById('confirm-danger-modal');
    if (modal) modal.classList.remove('active');
    if (isConfirmed && typeof confirmModalCallback === 'function') {
        confirmModalCallback();
    }
    confirmModalCallback = null;
}

/* ==========================================================================
   ИИ ПОМОЩНИК И ЧАТ
   ========================================================================== */
function openAiModal() {
    document.getElementById('ai-modal').classList.add('active');
}

function closeAiModal() {
    document.getElementById('ai-modal').classList.remove('active');
}

function switchAiMode(mode) {
    const genTab = document.getElementById('ai-tab-gen');
    const chatTab = document.getElementById('ai-tab-chat');
    const genContainer = document.getElementById('ai-mode-generate-container');
    const chatContainer = document.getElementById('ai-mode-chat-container');

    if (mode === 'generate') {
        genTab.classList.add('active');
        chatTab.classList.remove('active');
        genContainer.classList.remove('hidden');
        chatContainer.classList.add('hidden');
    } else {
        chatTab.classList.add('active');
        genTab.classList.remove('active');
        chatContainer.classList.remove('hidden');
        genContainer.classList.add('hidden');
    }
}

function generateAiSlides() {
    const prompt = document.getElementById('ai-prompt-input').value;
    const count = parseInt(document.getElementById('ai-slides-count').value) || 3;
    const status = document.getElementById('ai-status-msg');

    if (!prompt) {
        showAlert('Внимание', 'Введите тему презентации.');
        return;
    }

    status.innerText = 'ИИ генерирует слайды... Подождите.';
    status.classList.remove('hidden');

    setTimeout(() => {
        const generatedSlides = [
            { type: 'title-slide', title: prompt, subtitle: 'Сгенерировано ИИ-помощником' }
        ];

        for (let i = 1; i < count; i++) {
            generatedSlides.push({
                type: 'content',
                title: `Раздел ${i}: Аспект темы`,
                bullets: `Ключевая мысль ${i}.1\nВажная деталь ${i}.2\nВывод или следующий шаг`,
                notes: `Заметка для слайда ${i}`
            });
        }

        const newDeck = {
            id: 'deck-ai-' + Date.now(),
            title: prompt,
            slides: generatedSlides
        };

        decks.push(newDeck);
        switchDeck(newDeck.id);
        
        status.classList.add('hidden');
        closeAiModal();
        showAlert('Готово!', `Создана новая презентация с ${count} слайдами.`);
    }, 1500);
}

function sendAiChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const history = document.getElementById('ai-chat-history');
    const msg = input.value.trim();

    if (!msg) return;

    history.innerHTML += `<div style="text-align:right; color:var(--accent-color); font-weight:500;">Вы: ${escapeHtml(msg)}</div>`;
    input.value = '';

    setTimeout(() => {
        history.innerHTML += `<div style="text-align:left; color:var(--text-color);">🤖 ИИ: Отличный вопрос! Я могу помочь вам дополнить содержимое этих слайдов.</div>`;
        history.scrollTop = history.scrollHeight;
    }, 800);
}

/* ==========================================================================
   НАСТРОЙКИ И ЯЗЫК
   ========================================================================== */
function openSettingsModal() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

function saveAiAndDbSettings() {
    showAlert('Успех', 'Параметры сохранены.');
}

function openLanguageModal() {
    document.getElementById('language-modal').classList.add('active');
}

function closeLanguageModal() {
    document.getElementById('language-modal').classList.remove('active');
}

function setLanguage(lang) {
    if (window.i18nLibrary && window.i18nLibrary[lang]) {
        closeLanguageModal();
        showAlert('Язык изменен', `Выбран язык: ${lang.toUpperCase()}`);
    } else {
        closeLanguageModal();
        showAlert('Информация', `Выбран язык: ${lang.toUpperCase()}`);
    }
}

/* ==========================================================================
   ВСПОМОГАТЕЛЬНЫЕ ОКНА (ALERT & PROMPT)
   ========================================================================== */
function showAlert(title, text) {
    document.getElementById('custom-alert-msg').innerHTML = `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(text)}`;
    document.getElementById('custom-alert').classList.add('active');
}

function closeAlert() {
    document.getElementById('custom-alert').classList.remove('active');
}

function showPrompt(title, placeholder, callback) {
    document.getElementById('custom-prompt-title').innerText = title;
    const input = document.getElementById('custom-prompt-input');
    input.placeholder = placeholder;
    input.value = '';
    customPromptCallback = callback;
    document.getElementById('custom-prompt').classList.add('active');
}

function closePrompt(isConfirm) {
    const inputVal = document.getElementById('custom-prompt-input').value;
    document.getElementById('custom-prompt').classList.remove('active');
    if (isConfirm && typeof customPromptCallback === 'function') {
        customPromptCallback(inputVal);
    }
    customPromptCallback = null;
}

function closeDetailsModal() {
    document.getElementById('slide-details-modal').classList.remove('active');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
