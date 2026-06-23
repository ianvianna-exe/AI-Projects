const fs = require('fs');
const path = require('path');

const usersDir = path.join(__dirname, '..', 'settings', 'users');

function getUserFile(userId) {
    return path.join(usersDir, `${userId}.json`);
}

function checkAndResetMonth(userProfile) {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!userProfile.history) {
        userProfile.history = [];
    }

    if (!userProfile.expenses) {
        userProfile.expenses = [];
    }

    if (userProfile.expenses.length === 0) {
        return false;
    }

    const lastExpense = userProfile.expenses[userProfile.expenses.length - 1];
    const lastExpenseDate = new Date(lastExpense.created_at);
    const lastExpenseMonthStr = `${lastExpenseDate.getFullYear()}-${String(lastExpenseDate.getMonth() + 1).padStart(2, '0')}`;

    if (currentMonthStr !== lastExpenseMonthStr) {
        userProfile.history.push({
            month: lastExpenseMonthStr,
            totalSpent: parseFloat(userProfile.currentMonthSpent) || 0
        });

        userProfile.expenses = [];
        userProfile.currentMonthSpent = 0;
        return true;
    }

    return false;
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

        checkAndResetMonth(userProfile);

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

function getMonthlySummary(userId) {
    const filePath = getUserFile(userId);
    if (!fs.existsSync(filePath)) return { error: 'User profile not found.' };

    try {
        const userProfile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        checkAndResetMonth(userProfile);

        const categories = {};
        const expenses = userProfile.expenses || [];

        for (const exp of expenses) {
            categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
        }

        const sortedCategories = Object.entries(categories)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);

        return {
            name: userProfile.name,
            currentMonthSpent: userProfile.currentMonthSpent || 0,
            monthlyLimit: userProfile.monthlyLimit || 0,
            categories: sortedCategories
        };
    } catch (error) {
        return { error: 'Failed to generate summary.' };
    }
}

function getTotalSummary(userId) {
    const filePath = getUserFile(userId);
    if (!fs.existsSync(filePath)) return { error: 'User profile not found.' };

    try {
        const userProfile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const monthlyData = getMonthlySummary(userId);

        if (monthlyData.error) return monthlyData;

        const history = userProfile.history || [];
        const limit = userProfile.monthlyLimit || 0;

        let historyTotal = 0;
        let monthsWithinLimit = 0;

        for (const item of history) {
            historyTotal += item.totalSpent;
            if (item.totalSpent <= limit) {
                monthsWithinLimit++;
            }
        }

        return {
            ...monthlyData,
            historyTotal,
            totalMonths: history.length,
            monthsWithinLimit
        };
    } catch (error) {
        return { error: 'Failed to generate total summary.' };
    }
}

function getStatement(userId) {
    const filePath = getUserFile(userId);
    if (!fs.existsSync(filePath)) return { error: 'User profile not found.' };

    try {
        const userProfile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        checkAndResetMonth(userProfile);

        const expenses = userProfile.expenses || [];
        const recentExpenses = [...expenses].reverse().slice(0, 30);

        return {
            name: userProfile.name,
            expenses: recentExpenses
        };
    } catch (error) {
        return { error: 'Failed to generate statement.' };
    }
}

module.exports = {
    saveExpense,
    getMonthlySummary,
    getTotalSummary,
    getStatement
};