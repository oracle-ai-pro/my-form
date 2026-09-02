/**
 * Движок формул, вычислений и слэш-команд
 */
import { state } from './state.js';

class FormulaEngine {
    // Преобразование буквы колонки в индекс (A -> 1, B -> 2, Z -> 26)
    colToIdx(colStr) {
        let idx = 0;
        for (let i = 0; i < colStr.length; i++) {
            idx = idx * 26 + (colStr.charCodeAt(i) - 64);
        }
        return idx;
    }

    // Преобразование индекса в букву колонки (1 -> A, 2 -> B)
    idxToCol(idx) {
        let col = '';
        while (idx > 0) {
            let rem = (idx - 1) % 26;
            col = String.fromCharCode(65 + rem) + col;
            idx = Math.floor((idx - 1) / 26);
        }
        return col;
    }

    // Разбор диапазона ("A1:B3") в массив ячеек ["A1", "A2", "A3", "B1", "B2", "B3"]
    parseRange(rangeStr) {
        const match = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match) return [];

        const startCol = this.colToIdx(match[1].toUpperCase());
        const startRow = parseInt(match[2], 10);
        const endCol = this.colToIdx(match[3].toUpperCase());
        const endRow = parseInt(match[4], 10);

        const cells = [];
        for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
            for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
                cells.push(`${this.idxToCol(c)}${r}`);
            }
        }
        return cells;
    }

    // Получение числового значения ячейки
    getCellValue(coords) {
        const cell = state.getCell(coords);
        if (!cell) return 0;
        const val = parseFloat(cell.computed ?? cell.raw);
        return isNaN(val) ? 0 : val;
    }

    // Вычисление математических формул и выражений
    evaluate(rawValue) {
        if (typeof rawValue !== 'string') return rawValue;

        // Обработка слэш-команд
        if (rawValue.startsWith('/')) {
            return this.processSlashCommand(rawValue);
        }

        if (!rawValue.startsWith('=')) {
            return rawValue;
        }

        let expr = rawValue.substring(1).trim();

        try {
            // Обработка =SUM(A1:A10)
            expr = expr.replace(/SUM\(([A-Z]+\d+:[A-Z]+\d+)\)/gi, (_, range) => {
                const coords = this.parseRange(range);
                return coords.reduce((acc, c) => acc + this.getCellValue(c), 0);
            });

            // Обработка =AVG(A1:A10)
            expr = expr.replace(/AVG\(([A-Z]+\d+:[A-Z]+\d+)\)/gi, (_, range) => {
                const coords = this.parseRange(range);
                if (coords.length === 0) return 0;
                const sum = coords.reduce((acc, c) => acc + this.getCellValue(c), 0);
                return sum / coords.length;
            });

            // Обработка =COUNT(A1:A10)
            expr = expr.replace(/COUNT\(([A-Z]+\d+:[A-Z]+\d+)\)/gi, (_, range) => {
                const coords = this.parseRange(range);
                return coords.filter(c => {
                    const cell = state.getCell(c);
                    return cell && cell.raw !== '' && !isNaN(parseFloat(cell.computed));
                }).length;
            });

            // Безопасная подстановка значений одиночных ячеек (например, A1 + B2)
            expr = expr.replace(/\b[A-Z]+\d+\b/gi, (coords) => {
                const val = this.getCellValue(coords.toUpperCase());
                return typeof val === 'number' ? val : 0;
            });

            // Вычисление математического выражения
            const result = Function(`"use strict"; return (${expr})`)();
            return isNaN(result) ? '#VALUE!' : result;
        } catch (err) {
            return '#ERROR!';
        }
    }

    // Обработка слэш-команд (/date, /time)
    processSlashCommand(command) {
        const cmd = command.toLowerCase().trim();
        if (cmd === '/date') {
            return new Date().toLocaleDateString('ru-RU');
        }
        if (cmd === '/time') {
            return new Date().toLocaleTimeString('ru-RU');
        }
        return command;
    }
}

export const formulaEngine = new FormulaEngine();