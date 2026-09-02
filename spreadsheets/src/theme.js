/**
 * Модуль управления темами оформления, скруглениями и визуальным стилем
 */
import { state } from './state.js';

class ThemeManager {
    constructor() {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    // Инициализация при старте приложения
    init() {
        const settings = state.getSettings();
        this.applyTheme(settings.theme || 'dark');
        this.applyRadius(settings.radius || 'rounded');
        this.initSystemThemeListener();
    }

    // Применение темы оформления
    applyTheme(themeMode) {
        const root = document.documentElement;

        if (themeMode === 'auto') {
            const isSystemDark = this.mediaQuery.matches;
            root.setAttribute('data-theme', isSystemDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', themeMode);
        }

        state.updateSettings({ theme: themeMode });
    }

    // Применение радиусов скругления (sharp | rounded | full)
    applyRadius(radiusMode) {
        const validRadii = ['sharp', 'rounded', 'full'];
        const targetRadius = validRadii.includes(radiusMode) ? radiusMode : 'rounded';
        
        document.documentElement.setAttribute('data-radius', targetRadius);
        state.updateSettings({ radius: targetRadius });
    }

    // Отслеживание изменений темы в ОС (Windows/macOS/Android) для режима 'auto'
    initSystemThemeListener() {
        this.mediaQuery.addEventListener('change', (e) => {
            const currentSettings = state.getSettings();
            if (currentSettings.theme === 'auto') {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });
    }
}

export const themeManager = new ThemeManager();