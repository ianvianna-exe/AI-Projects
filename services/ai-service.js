const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const promptBase = fs.readFileSync(path.join(__dirname, '..', 'settings', 'ai-prompt.txt'), 'utf8');

async function parseExpense(message) {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
    const currentDate = localDate.toISOString().split('.')[0] + '-03:00';

    const systemPrompt = promptBase.replace('{{CURRENT_DATE}}', currentDate);

    try {
        const response = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        return { error: 'Failed to process AI request.' };
    }
}

module.exports = { parseExpense };