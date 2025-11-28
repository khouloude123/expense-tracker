// API Configuration
const API_URL = 'http://localhost:5000/api';
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';

let currentCurrency = 'USD';
let exchangeRates = {};
let categoryChart = null;
let incomeExpenseChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setDefaultDate();
    loadExchangeRates();
    loadTransactions();
    loadBudget();
    
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    document.getElementById('currencySelect').addEventListener('change', handleCurrencyChange);
    document.getElementById('filterType').addEventListener('change', loadTransactions);
    document.getElementById('filterCategory').addEventListener('change', loadTransactions);
});

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Load Exchange Rates
async function loadExchangeRates() {
    try {
        const response = await fetch(EXCHANGE_RATE_API);
        const data = await response.json();
        exchangeRates = data.rates;
    } catch (error) {
        console.error('Error loading exchange rates:', error);
        alert('Failed to load exchange rates. Using USD as default.');
    }
}

function handleCurrencyChange(e) {
    currentCurrency = e.target.value;
    loadTransactions();
    loadBudget();
}

function convertAmount(amount, fromCurrency = 'USD') {
    if (fromCurrency === currentCurrency) return amount;
    
    const amountInUSD = amount / (exchangeRates[fromCurrency] || 1);
    return amountInUSD * (exchangeRates[currentCurrency] || 1);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency
    }).format(amount);
}

// Add Transaction
async function addTransaction(e) {
    e.preventDefault();
    
    const transaction = {
        type: document.getElementById('type').value,
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        currency: currentCurrency
    };
    
    try {
        const response = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transaction)
        });
        
        if (response.ok) {
            document.getElementById('transactionForm').reset();
            setDefaultDate();
            loadTransactions();
            checkBudgetAlert();
        } else {
            alert('Failed to add transaction');
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
        alert('Error adding transaction. Make sure the server is running.');
    }
}

// Load Transactions
async function loadTransactions() {
    try {
        const filterType = document.getElementById('filterType').value;
        const filterCategory = document.getElementById('filterCategory').value;
        
        let url = `${API_URL}/transactions`;
        const params = [];
        if (filterType !== 'all') params.push(`type=${filterType}`);
        if (filterCategory !== 'all') params.push(`category=${filterCategory}`);
        if (params.length > 0) url += '?' + params.join('&');
        
        const response = await fetch(url);
        const transactions = await response.json();
        
        displayTransactions(transactions);
        updateBalance(transactions);
        updateCharts(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayTransactions(transactions) {
    const list = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No transactions found</p>';
        return;
    }
    
    list.innerHTML = transactions.map(t => {
        const amount = convertAmount(t.amount, t.currency || 'USD');
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-description">${t.category} - ${t.description}</div>
                    <div class="transaction-meta">${new Date(t.date).toLocaleDateString()}</div>
                </div>
                <span class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(amount)}</span>
                <button class="btn-delete" onclick="deleteTransaction('${t._id}')">Delete</button>
            </div>
        `;
    }).join('');
}

function updateBalance(transactions) {
    let totalIncome = 0;
    let totalExpenses = 0;
    
    transactions.forEach(t => {
        const amount = convertAmount(t.amount, t.currency || 'USD');
        if (t.type === 'income') {
            totalIncome += amount;
        } else {
            totalExpenses += amount;
        }
    });
    
    const balance = totalIncome - totalExpenses;
    
    document.getElementById('totalBalance').textContent = formatCurrency(balance);
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
}

function updateCharts(transactions) {
    const expenses = transactions.filter(t => t.type === 'expense');
    
    // Category Chart
    const categoryData = {};
    expenses.forEach(t => {
        const amount = convertAmount(t.amount, t.currency || 'USD');
        categoryData[t.category] = (categoryData[t.category] || 0) + amount;
    });
    
    const ctx1 = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    
    categoryChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Income vs Expense Chart
    let totalIncome = 0;
    let totalExpenses = 0;
    
    transactions.forEach(t => {
        const amount = convertAmount(t.amount, t.currency || 'USD');
        if (t.type === 'income') {
            totalIncome += amount;
        } else {
            totalExpenses += amount;
        }
    });
    
    const ctx2 = document.getElementById('incomeExpenseChart').getContext('2d');
    if (incomeExpenseChart) incomeExpenseChart.destroy();
    
    incomeExpenseChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
                label: 'Amount',
                data: [totalIncome, totalExpenses],
                backgroundColor: ['#2ecc71', '#e74c3c']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Delete Transaction
async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTransactions();
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
    }
}

// Budget Management
async function setBudget() {
    const amount = parseFloat(document.getElementById('budgetAmount').value);
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid budget amount');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/budget`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount, currency: currentCurrency })
        });
        
        if (response.ok) {
            document.getElementById('budgetAmount').value = '';
            loadBudget();
            checkBudgetAlert();
        }
    } catch (error) {
        console.error('Error setting budget:', error);
    }
}

async function loadBudget() {
    try {
        const response = await fetch(`${API_URL}/budget`);
        const budget = await response.json();
        
        if (budget) {
            const budgetAmount = convertAmount(budget.amount, budget.currency || 'USD');
            
            const transResponse = await fetch(`${API_URL}/transactions?type=expense`);
            const expenses = await transResponse.json();
            
            let totalExpenses = 0;
            expenses.forEach(t => {
                totalExpenses += convertAmount(t.amount, t.currency || 'USD');
            });
            
            const percentage = (totalExpenses / budgetAmount) * 100;
            const remaining = budgetAmount - totalExpenses;
            
            let statusClass = '';
            let alertHTML = '';
            
            if (percentage >= 100) {
                statusClass = 'danger';
                alertHTML = '<div class="budget-alert danger">⚠️ Budget exceeded! You\'ve spent more than your budget.</div>';
            } else if (percentage >= 80) {
                statusClass = 'warning';
                alertHTML = '<div class="budget-alert warning">⚠️ Warning! You\'ve used 80% of your budget.</div>';
            }
            
            document.getElementById('budgetDisplay').innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>Monthly Budget:</strong>
                    <span>${formatCurrency(budgetAmount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>Spent:</strong>
                    <span style="color: #e74c3c;">${formatCurrency(totalExpenses)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>Remaining:</strong>
                    <span style="color: ${remaining >= 0 ? '#2ecc71' : '#e74c3c'};">${formatCurrency(remaining)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div style="text-align: center; margin-top: 5px; font-weight: 600;">${percentage.toFixed(1)}% used</div>
                ${alertHTML}
            `;
        } else {
            document.getElementById('budgetDisplay').innerHTML = '<p style="color: #666;">No budget set. Set a monthly budget to track your spending.</p>';
        }
    } catch (error) {
        console.error('Error loading budget:', error);
    }
}

async function checkBudgetAlert() {
    try {
        const response = await fetch(`${API_URL}/budget`);
        const budget = await response.json();
        
        if (budget) {
            const budgetAmount = convertAmount(budget.amount, budget.currency || 'USD');
            
            const transResponse = await fetch(`${API_URL}/transactions?type=expense`);
            const expenses = await transResponse.json();
            
            let totalExpenses = 0;
            expenses.forEach(t => {
                totalExpenses += convertAmount(t.amount, t.currency || 'USD');
            });
            
            const percentage = (totalExpenses / budgetAmount) * 100;
            
            if (percentage >= 100) {
                alert('⚠️ Budget Alert: You have exceeded your monthly budget!');
            } else if (percentage >= 80) {
                alert('⚠️ Budget Warning: You have used 80% of your monthly budget!');
            }
        }
    } catch (error) {
        console.error('Error checking budget alert:', error);
    }
}