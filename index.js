require('dotenv').config();
const { connectWhatsApp } = require('./whatsapp-connector/whatsapp-connector');
const onboardingService = require('./services/onboarding-service');
const aiService = require('./services/ai-service');
const messages = require('./settings/messages.json');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const usersDir = path.join(__dirname, 'settings', 'users');
if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir, { recursive: true });
}

function loadUsersIntoMemory() {
    if (fs.existsSync(usersDir)) {
        const files = fs.readdirSync(usersDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const userId = file.replace('.json', '');
                try {
                    const profileData = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));

                    const originalGetUserProfile = onboardingService.getUserProfile;
                    onboardingService.getUserProfile = function (id) {
                        if (id === userId) return profileData;
                        return originalGetUserProfile(id);
                    };

                    const originalIsUserRegistered = onboardingService.isUserRegistered;
                    onboardingService.isUserRegistered = function (id) {
                        if (id === userId) return true;
                        return originalIsUserRegistered(id);
                    };
                } catch (e) { }
            }
        }
    }
}

async function processIncomingFlow(userId, message, sendMessage) {
    const cleanedMessage = message.trim();
    const userFile = path.join(usersDir, `${userId}.json`);

    if (cleanedMessage.toUpperCase() === '/INIT') {
        await onboardingService.startOnboarding(sendMessage, userId);
        return;
    }

    if (onboardingService.isUserInOnboarding(userId)) {
        await onboardingService.handleOnboarding(sendMessage, userId, cleanedMessage);

        if (onboardingService.isUserRegistered(userId)) {
            const profile = onboardingService.getUserProfile(userId);
            if (profile) {
                fs.writeFileSync(userFile, JSON.stringify(profile, null, 4));
            }
        }
        return;
    }

    if (fs.existsSync(userFile) || onboardingService.isUserRegistered(userId)) {
        if (cleanedMessage === 'ping') {
            await sendMessage('pong');
            return;
        }

        const aiResult = await aiService.parseExpense(cleanedMessage);
        await sendMessage(JSON.stringify(aiResult, null, 2));
    } else {
        await sendMessage(messages.flow.notRegistered);
    }
}

loadUsersIntoMemory();

rl.question('Enter session ID: ', async (sessionId) => {
    const cleanedId = sessionId.trim();

    if (!cleanedId) {
        rl.close();
        process.exit(1);
    }

    rl.close();

    try {
        await connectWhatsApp(cleanedId, processIncomingFlow);
    } catch (error) {
        process.exit(1);
    }
});