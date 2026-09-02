/**
 * Модуль экспорта и безопасной печати
 */
import { state } from './state.js';

class Exporter {
    // Безопасное экранирование HTML от XSS
    escapeHtml(str) {
        if (typeof str !== 'string') return str ?? '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    exportCSV() {
        const sheet = state.getActiveSheet();
        if (!sheet) return;

        let csv = '';
        for (let r = 1; r <= sheet.rows; r++) {
            const row = [];
            for (let c = 1; c <= sheet.cols; c++) {
                const colName = String.fromCharCode(64 + c);
                const cell = state.getCell(`${colName}${r}`);
                const val = cell ? (cell.computed ?? cell.raw) : '';
                row.push(`"${String(val).replace(/"/g, '""')}"`);
            }
            csv += row.join(',') + '\n';
        }

        this.downloadFile(csv, `${sheet.name}.csv`, 'text/csv;charset=utf-8;');
    }

    exportJSON() {
        const data = JSON.stringify(state.state, null, 2);
        this.downloadFile(data, 'spreadsheets_backup.json', 'application/json');
    }

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    print() {
        const sheet = state.getActiveSheet();
        if (!sheet) return;

        const printWin = window.open('about:blank', '_blank');
        if (!printWin) return;

        let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%; font-family: sans-serif;">';
        
        // Заголовки столбцов
        tableHtml += '<tr><th style="padding: 4px; background: #eee;">#</th>';
        for (let c = 1; c <= sheet.cols; c++) {
            tableHtml += `<th style="padding: 4px; background: #eee;">${String.fromCharCode(64 + c)}</th>`;
        }
        tableHtml += '</tr>';

        // Строки и ячейки
        for (let r = 1; r <= sheet.rows; r++) {
            tableHtml += `<tr><td style="padding: 4px; background: #eee; font-weight: bold; text-align: center;">${r}</td>`;
            for (let c = 1; c <= sheet.cols; c++) {
                const colName = String.fromCharCode(64 + c);
                const cell = state.getCell(`${colName}${r}`);
                const val = cell ? (cell.computed ?? cell.raw) : '';
                tableHtml += `<td style="padding: 4px;">${this.escapeHtml(String(val))}</td>`;
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</table>';

        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Печать: ${this.escapeHtml(sheet.name)}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { border-color: #ccc; }
                    td, th { font-size: 11px; }
                </style>
            </head>
            <body>
                <h2>${this.escapeHtml(sheet.name)}</h2>
                ${tableHtml}
            </body>
            </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
    }
}

export const exporter = new Exporter();