/**
 * Главная точка входа и контроллер событий приложения
 */
import { state } from './state.js';
import { themeManager } from './theme.js';
import { i18n } from './i18n.js';
import { formulaEngine } from './formula.js';
import { aiService } from './ai.js';
import { exporter } from './exporter.js';
import { renderer } from './renderer.js';

function initApp() {
    // 1. Инициализация модулей
    themeManager.init();
    i18n.init();
    renderer.init();

    // DOM Элементы
    const gridViewport = document.getElementById('grid-viewport');
    const formulaInput = document.getElementById('formula-input');
    const tabsContainer = document.getElementById('tabs-container');
    const tabsSelect = document.getElementById('forms-tabs-select');
    const btnAddTab = document.getElementById('btn-add-tab');

    // Кнопки тулбара
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnBold = document.getElementById('btn-bold');
    const btnItalic = document.getElementById('btn-italic');
    const btnAlignLeft = document.getElementById('btn-align-left');
    const btnAlignCenter = document.getElementById('btn-align-center');
    const btnAlignRight = document.getElementById('btn-align-right');
    const btnAiPrompt = document.getElementById('btn-ai-prompt');
    const btnExport = document.getElementById('btn-export');
    const btnPrint = document.getElementById('btn-print');

    // Модалка настроек
    const modalSettings = document.getElementById('modal-settings');
    const btnSettings = document.getElementById('menu-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnCancelSettings = document.getElementById('btn-cancel-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');

    // Настройки inputs
    const settingTheme = document.getElementById('setting-theme');
    const settingRadius = document.getElementById('setting-radius');
    const settingLanguage = document.getElementById('setting-language');
    const settingAiProvider = document.getElementById('setting-ai-provider');
    const settingAiKey = document.getElementById('setting-ai-key');
    const settingAiUrl = document.getElementById('setting-ai-url');
    const settingAiModel = document.getElementById('setting-ai-model');

    // --- КЛИК ПО ЯЧЕЙКАМ И СЕТКЕ ---
    if (gridViewport) {
        gridViewport.addEventListener('click', (e) => {
            const td = e.target.closest('td');
            if (!td) return;
            const coords = td.getAttribute('data-coords');
            if (coords) {
                state.setActiveCell(coords);
            }
        });
    }

    // Редактирование через строку формул
    if (formulaInput) {
        formulaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const activeCoords = state.state.selection.activeCell;
                const rawVal = formulaInput.value;
                const computedVal = formulaEngine.evaluate(rawVal);
                
                state.setCellValue(activeCoords, rawVal, computedVal);
                formulaInput.blur();
            }
        });
    }

    // --- ФОРМАТИРОВАНИЕ И ТУЛБАР ---
    btnBold?.addEventListener('click', () => {
        const active = state.state.selection.activeCell;
        const current = state.getCell(active)?.bold;
        state.setCellFormat(active, 'bold', !current);
    });

    btnItalic?.addEventListener('click', () => {
        const active = state.state.selection.activeCell;
        const current = state.getCell(active)?.italic;
        state.setCellFormat(active, 'italic', !current);
    });

    btnAlignLeft?.addEventListener('click', () => state.setCellFormat(state.state.selection.activeCell, 'align', 'left'));
    btnAlignCenter?.addEventListener('click', () => state.setCellFormat(state.state.selection.activeCell, 'align', 'center'));
    btnAlignRight?.addEventListener('click', () => state.setCellFormat(state.state.selection.activeCell, 'align', 'right'));

    btnUndo?.addEventListener('click', () => state.undo());
    btnRedo?.addEventListener('click', () => state.redo());

    // --- ИИ И ГЕНЕРАЦИЯ ---
    btnAiPrompt?.addEventListener('click', async () => {
        const active = state.state.selection.activeCell;
        const currentVal = state.getCell(active)?.raw || '';
        
        const prompt = window.prompt('Запрос для ИИ (или обработка ячейки):', currentVal);
        if (!prompt) return;

        state.setCellValue(active, 'Загрузка ИИ...', '⏳ Генерация...');
        const result = await aiService.generate(prompt);
        state.setCellValue(active, result, result);
    });

    // --- ЭКСПОРТ И ПЕЧАТЬ ---
    btnExport?.addEventListener('click', () => exporter.exportCSV());
    btnPrint?.addEventListener('click', () => exporter.print());

    // --- ВКЛАДКИ ---
    btnAddTab?.addEventListener('click', () => state.addSheet());

    tabsContainer?.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab-item');
        if (tab) {
            const sheetId = tab.getAttribute('data-sheet-id');
            state.switchSheet(sheetId);
        }
    });

    tabsSelect?.addEventListener('change', (e) => {
        state.switchSheet(e.target.value);
    });

    // Двойной клик по вкладке для переименования
    tabsContainer?.addEventListener('dblclick', (e) => {
        const tab = e.target.closest('.tab-item');
        if (!tab) return;
        const sheetId = tab.getAttribute('data-sheet-id');
        const currentName = state.state.sheets[sheetId].name;
        const newName = window.prompt('Введите новое название листа:', currentName);
        if (newName) {
            state.renameSheet(sheetId, newName);
        }
    });

    // --- УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ НАСТРОЕК ---
    const openSettings = () => {
        const s = state.getSettings();
        settingTheme.value = s.theme;
        settingRadius.value = s.radius;
        settingLanguage.value = s.language;
        settingAiProvider.value = s.aiProvider;
        settingAiKey.value = s.aiKey;
        settingAiUrl.value = s.aiUrl;
        settingAiModel.value = s.aiModel;

        modalSettings.classList.remove('hidden');
    };

    const closeSettings = () => modalSettings.classList.add('hidden');

    btnSettings?.addEventListener('click', openSettings);
    btnCloseSettings?.addEventListener('click', closeSettings);
    btnCancelSettings?.addEventListener('click', closeSettings);

    btnSaveSettings?.addEventListener('click', () => {
        themeManager.applyTheme(settingTheme.value);
        themeManager.applyRadius(settingRadius.value);
        i18n.setLanguage(settingLanguage.value);

        state.updateSettings({
            theme: settingTheme.value,
            radius: settingRadius.value,
            language: settingLanguage.value,
            aiProvider: settingAiProvider.value,
            aiKey: settingAiKey.value,
            aiUrl: settingAiUrl.value,
            aiModel: settingAiModel.value
        });

        closeSettings();
    });

    // Горячие клавиши (Ctrl+Z, Ctrl+Y)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            state.undo();
        } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            state.redo();
        }
    });
}

// Надежный запуск приложения в зависимости от состояния DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
// Элементы меню
const btnMenuFile = document.getElementById('menu-file'); // или по селектору/тексту
const btnMenuEdit = document.getElementById('menu-edit');
const btnMenuView = document.getElementById('menu-view');

// Файл -> Быстрый выбор действия
btnMenuFile?.addEventListener('click', () => {
    const action = window.prompt("Меню «Файл»:\n1. Экспорт CSV\n2. Печать\n\nВведите номер действия (1 или 2):");
    if (action === '1') exporter.exportCSV();
    if (action === '2') exporter.print();
});

// Правка -> Очистка или отмена
btnMenuEdit?.addEventListener('click', () => {
    const action = window.prompt("Меню «Правка»:\n1. Отменить (Undo)\n2. Повторить (Redo)\n3. Очистить ячейку\n\nВведите номер:");
    if (action === '1') state.undo();
    if (action === '2') state.redo();
    if (action === '3') {
        const active = state.state.selection.activeCell;
        state.setCellValue(active, '', '');
    }
});

// Вид -> Быстрое переключение тем
btnMenuView?.addEventListener('click', () => {
    const currentTheme = state.getSettings().theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    themeManager.applyTheme(nextTheme);
});
const ctxMenu = document.getElementById('context-menu');
const gridContainer = document.getElementById('grid-container'); // Твой контейнер таблицы

// 1. Перехватываем ПКМ по ячейкам
gridContainer?.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    // Находим ячейку, по которой кликнули
    const cell = e.target.closest('[data-coords]');
    if (!cell) return;

    // Выделяем ячейку, по которой кликнули
    const coords = cell.dataset.coords;
    state.setActiveCell(coords);

    // Позиционируем меню у курсора
    ctxMenu.style.top = `${e.clientY}px`;
    ctxMenu.style.left = `${e.clientX}px`;
    ctxMenu.style.display = 'block';
});

// 2. Скрываем меню при клике в любое другое место
document.addEventListener('click', () => {
    if (ctxMenu) ctxMenu.style.display = 'none';
});

// 3. Обработчик пункта "Очистить"
document.getElementById('ctx-clear')?.addEventListener('click', () => {
    const active = state.state.selection.activeCell;
    if (active) {
        state.setCellValue(active, '', '');
        renderer.render(); // Обновляем сетку
    }
});
// Добавление и удаление строк
document.getElementById('ctx-add-row')?.addEventListener('click', () => {
    state.addRow();
    renderer.render();
});

document.getElementById('ctx-del-row')?.addEventListener('click', () => {
    state.removeRow();
    renderer.render();
});

// Добавление и удаление столбцов
document.getElementById('ctx-add-col')?.addEventListener('click', () => {
    state.addCol();
    renderer.render();
});

document.getElementById('ctx-del-col')?.addEventListener('click', () => {
    state.removeCol();
    renderer.render();
});