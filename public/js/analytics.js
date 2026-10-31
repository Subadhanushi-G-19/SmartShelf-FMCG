const authToken = checkAuth();
if (!authToken) {
    window.location.href = '/index.html';
}

const currentUser = getCurrentUser();
if (currentUser) {
    document.getElementById('currentUser').textContent = currentUser.username;
}

// Load analytics data
async function loadAnalytics() {
    await loadWasteDashboard();
    await loadBuyingInsights();
    await updateNotificationBadge();
}

// Load waste dashboard
async function loadWasteDashboard() {
    try {
        const response = await fetch(`${API_URL}/analytics/waste-dashboard`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (result.success) {
            const data = result.data;

            // Update summary cards
            document.getElementById('totalWaste').textContent = `₹${data.totalMoneyWasted.toFixed(2)}`;
            document.getElementById('carbonFootprint').textContent = `${data.totalCarbonFootprint.toFixed(2)} kg`;
            document.getElementById('itemsWasted').textContent = data.totalItemsWasted;
            document.getElementById('avgWaste').textContent = `₹${data.averageWastePerItem}`;
            document.getElementById('potentialSavings').textContent = `₹${(data.totalMoneyWasted * 0.5).toFixed(2)}`;

            // Display waste chart
            displayWasteChart(data.categoryBreakdown, data.totalMoneyWasted);
        }
    } catch (error) {
        console.error('Failed to load waste data:', error);
        showToast('Failed to load analytics data', 'error');
    }
}

// Display waste chart
function displayWasteChart(categoryData, total) {
    const chart = document.getElementById('wasteChart');

    if (!categoryData || categoryData.length === 0) {
        chart.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📊</span>
                <p>No waste data available yet. Start tracking your products!</p>
            </div>
        `;
        return;
    }

    chart.innerHTML = categoryData.map(cat => {
        const percentage = ((cat.category_waste / total) * 100).toFixed(1);
        const icon = getCategoryIcon(cat.category);

        return `
            <div class="waste-item">
                <div class="waste-item-header">
                    <div class="waste-category">
                        <span>${icon}</span>
                        <span>${cat.category}</span>
                    </div>
                    <div class="waste-amount">₹${cat.category_waste.toFixed(2)}</div>
                </div>
                <div class="waste-bar">
                    <div class="waste-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="waste-details">
                    <span>${cat.quantity_wasted} items wasted</span>
                    <span>${percentage}% of total waste</span>
                </div>
            </div>
        `;
    }).join('');
}

// Get category icon
function getCategoryIcon(category) {
    const icons = {
        food: '🍕',
        medicine: '💊',
        cosmetics: '💄',
        household: '🏠',
        other: '📦'
    };
    return icons[category] || '📦';
}

// Load buying insights
async function loadBuyingInsights() {
    try {
        const response = await fetch(`${API_URL}/analytics/buying-insights`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (result.success) {
            displayBuyingInsights(result.insights);
        }
    } catch (error) {
        console.error('Failed to load buying insights:', error);
    }
}

// Display buying insights
function displayBuyingInsights(insights) {
    const container = document.getElementById('buyingInsights');

    if (!insights || insights.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📊</span>
                <p>Not enough data for insights yet. Keep tracking your products!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="insights-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Purchase Freq.</th>
                    <th>Waste Rate</th>
                    <th>Recommendation</th>
                </tr>
            </thead>
            <tbody>
                ${insights.slice(0, 10).map(item => {
                    const wasteRate = parseFloat(item.waste_rate);
                    const badgeClass = wasteRate > 30 ? 'badge-reduce' : 
                                      item.purchase_frequency > 8 ? 'badge-bulk' : 'badge-optimal';
                    
                    return `
                        <tr>
                            <td style="font-weight: 600;">${item.product_name}</td>
                            <td style="text-transform: capitalize;">${getCategoryIcon(item.category)} ${item.category}</td>
                            <td>${item.purchase_frequency}x</td>
                            <td>
                                <div class="waste-rate">
                                    <span class="${wasteRate > 30 ? 'waste-rate-bad' : 'waste-rate-good'}">
                                        ${wasteRate}%
                                    </span>
                                </div>
                            </td>
                            <td>
                                <span class="recommendation-badge ${badgeClass}">
                                    ${wasteRate > 30 ? '⚠️ Buy Less' : 
                                      item.purchase_frequency > 8 ? '✅ Buy Bulk' : '👍 Optimal'}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Update notification badge
async function updateNotificationBadge() {
    try {
        const response = await fetch(`${API_URL}/notifications/unread-count`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success && data.count > 0) {
            document.getElementById('notifBadge').textContent = data.count;
            document.getElementById('notifBadge').style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Failed to load notification count:', error);
    }
}

// Initialize
loadAnalytics();