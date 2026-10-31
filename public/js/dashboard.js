// Check authentication
const authToken = checkAuth();
if (!authToken) {
    window.location.href = '/index.html';
}

// Display current user
const currentUser = getCurrentUser();
if (currentUser) {
    document.getElementById('currentUser').textContent = currentUser.username;
}

let allProducts = [];

// Load dashboard data
async function loadDashboard() {
    await loadProducts();
    await updateNotificationBadge();
}

// Load products
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success) {
            allProducts = data.products;
            updateStats();
            displayPriorityItems();
            loadFinancialSummary();
            loadEnvironmentalSummary();
            loadRecommendations();
        }
    } catch (error) {
        console.error('Failed to load products:', error);
        showToast('Failed to load products', 'error');
    }
}

// Update stats
function updateStats() {
    const critical = allProducts.filter(p => p.status === 'critical').length;
    const warning = allProducts.filter(p => p.status === 'warning').length;
    const safe = allProducts.filter(p => p.status === 'safe').length;
    const expired = allProducts.filter(p => p.status === 'expired').length;
    
    document.getElementById('criticalCount').textContent = critical;
    document.getElementById('warningCount').textContent = warning;
    document.getElementById('safeCount').textContent = safe;
    document.getElementById('expiredCount').textContent = expired;
}

// Display priority items
function displayPriorityItems() {
    const priorityList = document.getElementById('priorityList');
    const criticalAndWarning = allProducts
        .filter(p => p.status === 'critical' || p.status === 'warning')
        .sort((a, b) => a.days_remaining - b.days_remaining)
        .slice(0, 5);
    
    if (criticalAndWarning.length === 0) {
        priorityList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">✅</span>
                <p>All products are safe!</p>
            </div>
        `;
        return;
    }
    
    priorityList.innerHTML = criticalAndWarning.map(p => `
        <div class="priority-item ${p.status}">
            <div class="priority-info">
                <div class="priority-name">${p.name}</div>
                <div class="priority-details">
                    ${p.days_remaining < 0 ? 
                        '<span class="status-badge expired">EXPIRED</span>' : 
                        `<span class="days-badge">${p.days_remaining} days left</span>`
                    }
                    <span class="risk-badge">Risk: ${p.health_risk_score}/100</span>
                </div>
            </div>
            <a href="/products.html?id=${p.id}" class="priority-action">View →</a>
        </div>
    `).join('');
}

// Load financial summary
async function loadFinancialSummary() {
    try {
        const response = await fetch(`${API_URL}/analytics/waste-dashboard`, {
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            document.getElementById('financialSummary').innerHTML = `
                <div class="metric-display">
                    <div class="metric-value">₹${data.totalMoneyWasted.toFixed(2)}</div>
                    <div class="metric-label">Total Money Wasted</div>
                </div>
                <div class="metric-grid">
                    <div class="metric-item">
                        <span class="metric-number">${data.totalItemsWasted}</span>
                        <span class="metric-text">Items Wasted</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-number">₹${data.averageWastePerItem}</span>
                        <span class="metric-text">Avg per Item</span>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load financial data:', error);
    }
}

// Load environmental summary
async function loadEnvironmentalSummary() {
    try {
        const response = await fetch(`${API_URL}/analytics/waste-dashboard`, {
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            const carbon = result.data.totalCarbonFootprint;
            document.getElementById('environmentalSummary').innerHTML = `
                <div class="metric-display">
                    <div class="metric-value">${carbon.toFixed(2)} kg CO₂</div>
                    <div class="metric-label">Carbon Footprint</div>
                </div>
                <div class="eco-tip">
                    <span class="tip-icon">💡</span>
                    <p>Reducing waste by 50% could save ${(carbon * 0.5).toFixed(2)} kg CO₂!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load environmental data:', error);
    }
}

// Load recommendations
async function loadRecommendations() {
    try {
        const response = await fetch(`${API_URL}/analytics/rescue-recommendations`, {
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success && result.recommendations.length > 0) {
            const recs = result.recommendations.slice(0, 3);
            document.getElementById('recommendations').innerHTML = recs.map(rec => `
                <div class="recommendation-card">
                    <div class="rec-header">
                        <strong>${rec.name}</strong>
                        <span class="rec-days">${Math.floor(rec.days_remaining)} days left</span>
                    </div>
                    <div class="rec-suggestions">
                        ${rec.recommendations.map(r => `
                            <div class="rec-item">
                                <span class="rec-icon">${
                                    r.type === 'recipe' ? '🍳' : 
                                    r.type === 'preservation' ? '❄️' : 
                                    r.type === 'donation' ? '💝' : '📢'
                                }</span>
                                <span class="rec-text">${r.description}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            document.getElementById('recommendations').innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">✨</span>
                    <p>No urgent recommendations at this time</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load recommendations:', error);
    }
}

// Update notification badge
async function updateNotificationBadge() {
    try {
        const response = await fetch(`${API_URL}/notifications/unread-count`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success) {
            const badge = document.getElementById('notifBadge');
            if (data.count > 0) {
                badge.textContent = data.count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Failed to load notification count:', error);
    }
}

// Initialize dashboard
loadDashboard();

// Auto-refresh every 5 minutes
setInterval(loadDashboard, 300000);