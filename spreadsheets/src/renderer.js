/**
 * Движок отрисовки интерфейса таблицы и вкладок
 */
import { state } from './state.js';
import { formulaEngine } from './formula.js';

class GridRenderer {
    constructor() {
        this.viewport = null;
        this.tabsContainer = null;
        this.tabsSelect = null;
        this.formulaInput = null;
        this.addressBox = null;
    }

    init() {
        this.viewport = document.getElementById('grid-viewport');
        this.tabsContainer = document.getElementById('tabs-container');
        this.tabsSelect = document.getElementById('forms-tabs-select');
        this.formulaInput = document.getElementById('formula-input');
        this.addressBox = document.getElementById('active-cell-address');

        // Подписываемся на изменения состояния
        state.subscribe(() => {
            this.renderGrid();
            this.renderTabs();
            this.updateFormulaBar();
        });

        this.renderGrid();
        this.renderTabs();
    }

    // Отрисовка основной сетки
    renderGrid() {
        const sheet = state.getActiveSheet();
        if (!sheet || !this.viewport) return;

        const activeCoords = state.state.selection.activeCell;

        let html = '<table class="spreadsheet-table"><thead><tr><th></th>';

        // Заголовки столбцов (A, B, C...)
        for (let c = 1; c <= sheet.cols; c++) {
            html += `<th>${formulaEngine.idxToCol(c)}</th>`;
        }
        html += '</tr></thead><tbody>';

        // Строки и ячейки
        for (let r = 1; r <= sheet.rows; r++) {
            html += `<tr><th>${r}</th>`;
            for (let c = 1; c <= sheet.cols; c++) {
                const colName = formulaEngine.idxToCol(c);
                const coords = `${colName}${r}`;
                const cell = sheet.cells[coords] || {};
                
                const isSelected = coords === activeCoords;
                const displayVal = cell.computed !== undefined ? cell.computed : (cell.raw || '');

                // Стили форматирования ячейки
                let style = '';
                if (cell.bold) style += 'font-weight: bold; ';
                if (cell.italic) style += 'font-style: italic; ';
                if (cell.align) style += `text-align: ${cell.align}; `;

                html += `
                    <td data-coords="${coords}" 
                        class="${isSelected ? 'selected' : ''}" 
                        style="${style}">
                        ${this.escapeHtml(String(displayVal))}
                    </td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';

        this.viewport.innerHTML = html;
    }

    // Отрисовка нижней панели компактных вкладок
    renderTabs() {
        if (!this.tabsContainer || !this.tabsSelect) return;

        const { sheetOrder, sheets, activeSheetId } = state.state;

        // Вкладки для ПК
        let tabsHtml = '';
        let selectHtml = '';

        sheetOrder.forEach(id => {
            const sheet = sheets[id];
            if (!sheet) return;

            const isActive = id === activeSheetId;
            tabsHtml += `
                <button class="tab-item ${isActive ? 'active' : ''}" data-sheet-id="${id}">
                    ${this.escapeHtml(sheet.name)}
                </button>`;

            selectHtml += `
                <option value="${id}" ${isActive ? 'selected' : ''}>
                    ${this.escapeHtml(sheet.name)}
                </option>`;
        });

        this.tabsContainer.innerHTML = tabsHtml;
        this.tabsSelect.innerHTML = selectHtml;
    }

    // Обновление строки формул (Formula Bar)
    updateFormulaBar() {
        const activeCoords = state.state.selection.activeCell;
        const cell = state.getCell(activeCoords);

        if (this.addressBox) this.addressBox.textContent = activeCoords;
        if (this.formulaInput && document.activeElement !== this.formulaInput) {
            this.formulaInput.value = cell ? (cell.raw || '') : '';
        }
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

export const renderer = new GridRenderer();