const { connectWhatsApp } = require('./whatsapp-connector/whatsapp-connector');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function handleMessage(userId, message, sendMessage) {
    if (message.trim() === 'ping') {
        await sendMessage('pong');
    }
}

rl.question('Enter session ID: ', async (sessionId) => {
    const cleanedId = sessionId.trim();

    if (!cleanedId) {
        rl.close();
        process.exit(1);
    }

    rl.close();

    try {
        await connectWhatsApp(cleanedId, handleMessage);
    } catch (error) {
        process.exit(1);
    }
});