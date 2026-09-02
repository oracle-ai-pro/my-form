/**
 * Управление состоянием приложения (State Management)
 */

const STORAGE_KEY = 'prestige_spreadsheet_state';

// Дефолтное состояние приложения
const DEFAULT_STATE = {
    activeSheetId: 'sheet_1',
    sheetOrder: ['sheet_1'],
    sheets: {
        'sheet_1': {
            id: 'sheet_1',
            name: 'Лист 1',
            rows: 50,
            cols: 26,
            cells: {} // Структура: { "A1": { raw: "=SUM(B1:B5)", computed: 15, bold: true, align: "left" } }
        }
    },
    settings: {
        theme: 'dark',
        radius: 'rounded',
        language: 'ru',
        aiProvider: 'openai',
        aiKey: '',
        aiUrl: 'http://localhost:11434/v1',
        aiModel: 'gpt-4o'
    },
    selection: {
        activeCell: 'A1',
        selectedRange: null
    }
};

class StateManager {
    constructor() {
        this.state = this.loadState();
        this.undoStack = [];
        this.redoStack = [];
        this.listeners = [];
    }

    // Загрузка из localStorage
    loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return JSON.parse(JSON.stringify(DEFAULT_STATE));
            
            const parsed = JSON.parse(saved);
            return {
                ...DEFAULT_STATE,
                ...parsed,
                settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) }
            };
        } catch (e) {
            console.error('Ошибка загрузки состояния из localStorage:', e);
            return JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
    }

    // Сохранение в localStorage
    saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.error('Ошибка сохранения состояния:', e);
        }
    }

    // Подписка на изменения состояния
    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.saveState();
        this.listeners.forEach(fn => fn(this.state));
    }

    // --- РАБОТА С ЯЧЕЙКАМИ ---

    getActiveSheet() {
        return this.state.sheets[this.state.activeSheetId];
    }

    getCell(coords) {
        const sheet = this.getActiveSheet();
        return sheet ? sheet.cells[coords] || null : null;
    }

    setCellValue(coords, rawValue, computedValue = null) {
        this.pushHistory();
        const sheet = this.getActiveSheet();
        if (!sheet) return;

        if (!sheet.cells[coords]) {
            sheet.cells[coords] = {};
        }

        sheet.cells[coords].raw = rawValue;
        sheet.cells[coords].computed = computedValue !== null ? computedValue : rawValue;

        // Если ячейка пустая, удаляем её из объекта для экономии памяти
        if (rawValue === '' && Object.keys(sheet.cells[coords]).length <= 2) {
            delete sheet.cells[coords];
        }

        this.notify();
    }

    setCellFormat(coords, key, value) {
        this.pushHistory();
        const sheet = this.getActiveSheet();
        if (!sheet) return;

        if (!sheet.cells[coords]) {
            sheet.cells[coords] = { raw: '', computed: '' };
        }

        sheet.cells[coords][key] = value;
        this.notify();
    }

    // --- РАБОТА С ВКЛАДКАМИ (ЛИСТАМИ) ---

    addSheet(name = null) {
        this.pushHistory();
        const id = `sheet_${Date.now()}`;
        const sheetCount = this.state.sheetOrder.length + 1;
        const sheetName = name || `Лист ${sheetCount}`;

        this.state.sheets[id] = {
            id,
            name: sheetName,
            rows: 50,
            cols: 26,
            cells: {}
        };
        this.state.sheetOrder.push(id);
        this.state.activeSheetId = id;

        this.notify();
        return id;
    }

    switchSheet(id) {
        if (this.state.sheets[id]) {
            this.state.activeSheetId = id;
            this.state.selection.activeCell = 'A1';
            this.notify();
        }
    }

    deleteSheet(id) {
        if (this.state.sheetOrder.length <= 1) return; // Нельзя удалить последний лист

        this.pushHistory();
        delete this.state.sheets[id];
        this.state.sheetOrder = this.state.sheetOrder.filter(sId => sId !== id);
        
        if (this.state.activeSheetId === id) {
            this.state.activeSheetId = this.state.sheetOrder[0];
        }

        this.notify();
    }

    renameSheet(id, newName) {
        if (this.state.sheets[id] && newName.trim()) {
            this.pushHistory();
            this.state.sheets[id].name = newName.trim();
            this.notify();
        }
    }

    // --- ВЫДЕЛЕНИЕ ---

    setActiveCell(coords) {
        this.state.selection.activeCell = coords;
        this.notify();
    }

    // --- НАСТРОЙКИ ---

    getSettings() {
        return this.state.settings;
    }

    updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        this.notify();
    }

    // --- UNDO / REDO ---

    pushHistory() {
        const snapshot = JSON.stringify(this.state.sheets);
        this.undoStack.push(snapshot);
        if (this.undoStack.length > 30) this.undoStack.shift(); // Лимит 30 шагов
        this.redoStack = []; // Очищаем Redo при новом действии
    }

    undo() {
        if (this.undoStack.length === 0) return;
        this.redoStack.push(JSON.stringify(this.state.sheets));
        const previousSheets = JSON.parse(this.undoStack.pop());
        this.state.sheets = previousSheets;
        this.notify();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.undoStack.push(JSON.stringify(this.state.sheets));
        const nextSheets = JSON.parse(this.redoStack.pop());
        this.state.sheets = nextSheets;
        this.notify();
    }
}

// Внутри класса State:

addRow() {
    const sheet = this.getActiveSheet();
    if (sheet) {
        sheet.rows += 1;
        this.notify();
    }
}

removeRow() {
    const sheet = this.getActiveSheet();
    if (sheet && sheet.rows > 1) {
        sheet.rows -= 1;
        this.notify();
    }
}

addCol() {
    const sheet = this.getActiveSheet();
    if (sheet) {
        sheet.cols += 1;
        this.notify();
    }
}

removeCol() {
    const sheet = this.getActiveSheet();
    if (sheet && sheet.cols > 1) {
        sheet.cols -= 1;
        this.notify();
    }
}

export const state = new StateManager();