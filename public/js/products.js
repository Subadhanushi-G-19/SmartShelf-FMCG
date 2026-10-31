const authToken = checkAuth();
if (!authToken) {
    window.location.href = '/index.html';
}

const currentUser = getCurrentUser();
if (currentUser) {
    document.getElementById('currentUser').textContent = currentUser.username;
}

let allProducts = [];
let filteredProducts = [];

// Load products
async function loadProducts() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('productsGrid').style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/products`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            allProducts = data.products;
            filteredProducts = allProducts;
            updateMiniStats();
            applyFilters();
        }
    } catch (error) {
        console.error('Failed to load products:', error);
        showToast('Failed to load products', 'error');
    } finally {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('productsGrid').style.display = 'grid';
    }
}

// Update mini stats
function updateMiniStats() {
    const total = allProducts.length;
    const critical = allProducts.filter(p => p.status === 'critical').length;
    const warning = allProducts.filter(p => p.status === 'warning').length;
    const safe = allProducts.filter(p => p.status === 'safe').length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('criticalCountMini').textContent = critical;
    document.getElementById('warningCountMini').textContent = warning;
    document.getElementById('safeCountMini').textContent = safe;
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    filteredProducts = allProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            (product.brand && product.brand.toLowerCase().includes(searchTerm));
        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || product.status === statusFilter;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort products
    filteredProducts.sort((a, b) => {
        switch(sortBy) {
            case 'expiry_asc':
                return a.days_remaining - b.days_remaining;
            case 'expiry_desc':
                return b.days_remaining - a.days_remaining;
            case 'risk_desc':
                return b.health_risk_score - a.health_risk_score;
            case 'risk_asc':
                return a.health_risk_score - b.health_risk_score;
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            default:
                return 0;
        }
    });

    displayProducts();
}

// Display products
function displayProducts() {
    const grid = document.getElementById('productsGrid');

    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <span class="empty-icon">📦</span>
                <h3>No products found</h3>
                <p>Try adjusting your filters or add a new product</p>
                <a href="/add-product.html" class="btn-primary" style="display: inline-block; margin-top: 20px;">
                    <span>+ Add Your First Product</span>
                </a>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredProducts.map(product => {
        const riskColor = product.health_risk_score >= 70 ? '#e74c3c' :
                         product.health_risk_score >= 50 ? '#f39c12' :
                         product.health_risk_score >= 30 ? '#ff9800' :
                         product.health_risk_score >= 10 ? '#27ae60' : '#2196f3';

        return `
            <div class="product-card ${product.status}">
                <div class="product-header">
                    <div>
                        <div class="product-name">${product.name}</div>
                        ${product.brand ? `<div style="color: var(--gray); font-size: 0.85rem; margin-top: 4px;">${product.brand}</div>` : ''}
                    </div>
                    <div class="product-category">${getCategoryIcon(product.category)} ${product.category}</div>
                </div>

                <div class="days-remaining ${product.status}">
                    ${product.days_remaining < 0 
                        ? `❌ Expired ${Math.abs(product.days_remaining)} days ago` 
                        : `⏰ ${product.days_remaining} days remaining`
                    }
                </div>

                <div class="product-details">
                    <div class="product-detail-row">
                        <span class="detail-icon">📅</span>
                        <span class="detail-label">Expires:</span>
                        <span class="detail-value">${formatDate(product.dynamic_expiry_date)}</span>
                    </div>
                    <div class="product-detail-row">
                        <span class="detail-icon">📦</span>
                        <span class="detail-label">Quantity:</span>
                        <span class="detail-value">${product.quantity} ${product.unit}</span>
                    </div>
                    <div class="product-detail-row">
                        <span class="detail-icon">🌡️</span>
                        <span class="detail-label">Storage:</span>
                        <span class="detail-value">${formatStorage(product.storage_condition)}</span>
                    </div>
                    ${product.date_opened ? `
                    <div class="product-detail-row">
                        <span class="detail-icon">📭</span>
                        <span class="detail-label">Opened:</span>
                        <span class="detail-value">${formatDate(product.date_opened)}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="risk-score">
                    <div>
                        <div class="risk-score-label">Risk Score</div>
                        <div class="risk-score-value" style="color: ${riskColor};">
                            ${product.health_risk_score}/100
                        </div>
                    </div>
                    <div class="risk-bar">
                        <div class="risk-bar-fill" style="width: ${product.health_risk_score}%; background: ${riskColor};"></div>
                    </div>
                </div>

                <div class="product-actions">
                    <button class="action-btn btn-consume" onclick="consumeProduct(${product.id})">
                        ✓ Consume
                    </button>
                    <button class="action-btn btn-delete" onclick="deleteProduct(${product.id})">
                        🗑️ Delete
                    </button>
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

// Consume product
async function consumeProduct(productId) {
    if (!confirm('Mark this product as consumed?')) return;

    try {
        const response = await fetch(`${API_URL}/products/${productId}/consume`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ quantity: 1 })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Product consumed successfully!', 'success');
            loadProducts();
        } else {
            showToast(data.message || 'Failed to consume product', 'error');
        }
    } catch (error) {
        showToast('Failed to consume product', 'error');
    }
}

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const reason = prompt('Reason for deletion (optional):') || 'Deleted by user';
    const price = prompt('Original price in ₹ (for waste tracking):') || '0';

    try {
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                reason, 
                price: parseFloat(price) 
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Product deleted successfully!', 'success');
            loadProducts();
        } else {
            showToast(data.message || 'Failed to delete product', 'error');
        }
    } catch (error) {
        showToast('Failed to delete product', 'error');
    }
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

// Event listeners
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('categoryFilter').addEventListener('change', applyFilters);
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('sortBy').addEventListener('change', applyFilters);

// Initialize
loadProducts();
updateNotificationBadge();