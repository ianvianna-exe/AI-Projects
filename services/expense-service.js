const fs = require('fs');
const path = require('path');

const usersDir = path.join(__dirname, '..', 'settings', 'users');

function getUserFile(userId) {
    return path.join(usersDir, `${userId}.json`);
}

function saveExpense(userId, aiResult) {
    if (!aiResult || aiResult.error) {
        return { error: aiResult ? aiResult.error : 'Invalid AI data' };
    }

    const filePath = getUserFile(userId);
    if (!fs.existsSync(filePath)) {
        return { error: 'User profile not found.' };
    }

    try {
        const userProfile = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (!userProfile.expenses) {
            userProfile.expenses = [];
        }

        const expensesToAdd = Array.isArray(aiResult) ? aiResult : [aiResult];

        let totalAdded = 0;
        for (const expense of expensesToAdd) {
            userProfile.expenses.push({
                description: expense.description,
                amount: expense.amount,
                category: expense.category,
                created_at: expense.created_at
            });
            totalAdded += expense.amount;
        }

        userProfile.currentMonthSpent = (parseFloat(userProfile.currentMonthSpent) || 0) + totalAdded;

        fs.writeFileSync(filePath, JSON.stringify(userProfile, null, 4));

        return { success: true, profile: userProfile, totalAdded };
    } catch (error) {
        return { error: 'Failed to update user profile expenses.' };
    }
}

module.exports = { saveExpense };