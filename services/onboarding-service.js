const path = require('path');
const messages = require('../settings/messages.json');

const userStates = new Map();
const userProfiles = new Map();

function isUserRegistered(userId) {
    return userProfiles.has(userId);
}

function getUserProfile(userId) {
    return userProfiles.get(userId);
}

async function startOnboarding(sendMessage, userId) {
    userStates.set(userId, { step: 'AWAITING_NAME' });
    await sendMessage(messages.onboarding.welcome);
}

function isUserInOnboarding(userId) {
    return userStates.has(userId);
}

async function handleOnboarding(sendMessage, userId, message) {
    const currentState = userStates.get(userId);
    if (!currentState) return;

    switch (currentState.step) {
        case 'AWAITING_NAME':
            currentState.name = message;
            currentState.step = 'AWAITING_AGE';
            await sendMessage(messages.onboarding.askAge);
            break;

        case 'AWAITING_AGE':
            const age = parseInt(message);
            if (isNaN(age) || age <= 0) {
                await sendMessage(messages.onboarding.invalidAge);
                return;
            }
            currentState.age = age;
            currentState.step = 'AWAITING_GOAL';
            await sendMessage(messages.onboarding.askGoal);
            break;

        case 'AWAITING_GOAL':
            currentState.goal = message;
            currentState.step = 'AWAITING_LIMIT';
            await sendMessage(messages.onboarding.askLimit);
            break;

        case 'AWAITING_LIMIT':
            const cleanLimit = message.replace(/[^\d,.-]/g, '').replace(',', '.');
            const limit = parseFloat(cleanLimit);

            if (isNaN(limit) || limit <= 0) {
                await sendMessage(messages.onboarding.invalidLimit);
                return;
            }

            const profile = {
                name: currentState.name,
                age: currentState.age,
                goal: currentState.goal,
                monthlyLimit: limit,
                currentMonthSpent: 0.00
            };

            userProfiles.set(userId, profile);
            userStates.delete(userId);

            const welcomeText = messages.onboarding.successTemplate
                .replace('{{name}}', profile.name)
                .replace('{{limit}}', profile.monthlyLimit.toFixed(2));

            await sendMessage(welcomeText);
            break;
    }
}

module.exports = {
    isUserRegistered,
    getUserProfile,
    startOnboarding,
    isUserInOnboarding,
    handleOnboarding
};