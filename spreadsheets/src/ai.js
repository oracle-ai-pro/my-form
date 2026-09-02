/**
 * Мультипровайдерный адаптер ИИ
 */
import { state } from './state.js';

class AIService {
    async generate(prompt) {
        const settings = state.getSettings();
        const provider = settings.aiProvider || 'openai';
        const apiKey = settings.aiKey;
        const baseUrl = settings.aiUrl || 'http://localhost:11434/v1';
        const model = settings.aiModel || 'gpt-4o';

        if (!apiKey && provider !== 'custom') {
            return 'Ошибка: API-ключ не указан в настройках.';
        }

        try {
            if (provider === 'openai' || provider === 'custom') {
                const url = provider === 'openai' 
                    ? 'https://api.openai.com/v1/chat/completions' 
                    : `${baseUrl.replace(/\/$/, '')}/chat/completions`;

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });
                const data = await res.json();
                return data.choices?.[0]?.message?.content || 'Нет ответа от ИИ';
            }

            if (provider === 'anthropic') {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: model || 'claude-3-5-sonnet-20240620',
                        max_tokens: 1024,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });
                const data = await res.json();
                return data.content?.[0]?.text || 'Нет ответа от Claude';
            }

            if (provider === 'gemini') {
                const targetModel = model || 'gemini-1.5-flash';
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
                
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
                const data = await res.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Нет ответа от Gemini';
            }

            return 'Выбран неизвестный провайдер ИИ.';
        } catch (err) {
            console.error('AI Request Error:', err);
            return `Ошибка ИИ: ${err.message}`;
        }
    }
}

export const aiService = new AIService();