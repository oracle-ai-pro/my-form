/**
 * Движок мультиязычности (RU / EN)
 */
import { state } from './state.js';

const TRANSLATIONS = {
    ru: {
        'menu.file': 'Файл',
        'menu.edit': 'Правка',
        'menu.view': 'Вид',
        'menu.settings': 'Параметры и ИИ',
        'btn.export': 'Экспорт',
        'btn.print': 'Печать',
        'ctx.insert_row_above': 'Вставить строку выше',
        'ctx.insert_row_below': 'Вставить строку ниже',
        'ctx.insert_col_left': 'Вставить столбец слева',
        'ctx.insert_col_right': 'Вставить столбец справа',
        'ctx.delete_row': 'Удалить строку',
        'ctx.delete_col': 'Удалить столбец',
        'ctx.clear': 'Очистить ячейки',
        'settings.title': 'Параметры и Настройки ИИ',
        'settings.appearance': 'Внешний вид',
        'settings.theme': 'Тема оформления:',
        'settings.radius': 'Тип скруглений:',
        'settings.language': 'Язык интерфейса:',
        'settings.ai_config': 'Интеграция с ИИ',
        'settings.ai_provider': 'Провайдер ИИ:',
        'settings.ai_key': 'API Ключ:',
        'settings.ai_url': 'Base URL (для Custom/Local):',
        'settings.ai_model': 'Модель:',
        'btn.cancel': 'Отмена',
        'btn.save': 'Сохранить'
    },
    en: {
        'menu.file': 'File',
        'menu.edit': 'Edit',
        'menu.view': 'View',
        'menu.settings': 'Settings & AI',
        'btn.export': 'Export',
        'btn.print': 'Print',
        'ctx.insert_row_above': 'Insert row above',
        'ctx.insert_row_below': 'Insert row below',
        'ctx.insert_col_left': 'Insert column left',
        'ctx.insert_col_right': 'Insert column right',
        'ctx.delete_row': 'Delete row',
        'ctx.delete_col': 'Delete column',
        'ctx.clear': 'Clear cells',
        'settings.title': 'Preferences & AI Settings',
        'settings.appearance': 'Appearance',
        'settings.theme': 'Theme:',
        'settings.radius': 'Border Radius:',
        'settings.language': 'Interface Language:',
        'settings.ai_config': 'AI Integration',
        'settings.ai_provider': 'AI Provider:',
        'settings.ai_key': 'API Key:',
        'settings.ai_url': 'Base URL (for Custom/Local):',
        'settings.ai_model': 'Model:',
        'btn.cancel': 'Cancel',
        'btn.save': 'Save'
    }
};

class I18nManager {
    init() {
        const lang = state.getSettings().language || 'ru';
        this.setLanguage(lang);
    }

    setLanguage(lang) {
        const targetLang = TRANSLATIONS[lang] ? lang : 'ru';
        state.updateSettings({ language: targetLang });

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (TRANSLATIONS[targetLang][key]) {
                el.textContent = TRANSLATIONS[targetLang][key];
            }
        });
    }

    t(key) {
        const lang = state.getSettings().language || 'ru';
        return TRANSLATIONS[lang]?.[key] || key;
    }
}

export const i18n = new I18nManager();