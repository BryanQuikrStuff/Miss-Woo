// Miss-Woo Frontend Application
class MissWooApp {
    constructor() {
        this.apiBaseUrl = 'https://your-api-domain.com/api'; // Update with your hosted API URL
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeMissive();
    }

    bindEvents() {
        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.handleSearch());
        document.getElementById('orderSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Quick action buttons
        document.getElementById('recentOrders').addEventListener('click', () => this.getRecentOrders());
        document.getElementById('trackingOrders').addEventListener('click', () => this.getTrackingOrders());
        document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
    }

    initializeMissive() {
        // Initialize Missive iframe integration
        if (window.Missive) {
            window.Missive.on('ready', () => {
                console.log('Missive iframe ready');
                this.loadInitialData();
            });
        }
    }

    async handleSearch() {
        const searchTerm = document.getElementById('orderSearch').value.trim();
        if (!searchTerm) {
            this.showError('Please enter an order ID or customer email');
            return;
        }

        this.showLoading();
        
        try {
            // Check if it's an order ID (numeric)
            if (/^\d+$/.test(searchTerm)) {
                await this.getOrderById(searchTerm);
            } else {
                // Assume it's an email, search orders
                await this.searchOrdersByEmail(searchTerm);
            }
        } catch (error) {
            this.showError('Search failed: ' + error.message);
        }
    }

    async getOrderById(orderId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/orders/${orderId}`);
            if (!response.ok) throw new Error('Order not found');
            
            const order = await response.json();
            this.displayOrder(order);
        } catch (error) {
            this.showError(`Failed to fetch order ${orderId}: ${error.message}`);
        }
    }

    async searchOrdersByEmail(email) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/orders?email=${encodeURIComponent(email)}`);
            if (!response.ok) throw new Error('Failed to search orders');
            
            const orders = await response.json();
            this.displayOrdersList(orders);
        } catch (error) {
            this.showError(`Failed to search orders for ${email}: ${error.message}`);
        }
    }

    async getRecentOrders() {
        this.showLoading();
        try {
            const response = await fetch(`${this.apiBaseUrl}/orders?per_page=10`);
            if (!response.ok) throw new Error('Failed to fetch recent orders');
            
            const orders = await response.json();
            this.displayOrdersList(orders);
        } catch (error) {
            this.showError('Failed to fetch recent orders: ' + error.message);
        }
    }

    async getTrackingOrders() {
        this.showLoading();
        try {
            const response = await fetch(`${this.apiBaseUrl}/orders/tracking/all`);
            if (!response.ok) throw new Error('Failed to fetch tracking orders');
            
            const orders = await response.json();
            this.displayTrackingOrders(orders);
        } catch (error) {
            this.showError('Failed to fetch tracking orders: ' + error.message);
        }
    }

    async testConnection() {
        this.showLoading();
        try {
            const response = await fetch(`${this.apiBaseUrl}/products`);
            if (!response.ok) throw new Error('API connection failed');
            
            this.showSuccess('✅ WooCommerce API connection successful!');
        } catch (error) {
            this.showError('❌ API connection failed: ' + error.message);
        }
    }

    displayOrder(order) {
        const resultsContainer = document.getElementById('results');
        const trackingInfo = order.tracking || {};
        
        resultsContainer.innerHTML = `
            <div class="order-card">
                <div class="order-header">
                    <h3>Order #${order.id}</h3>
                    <span class="status ${order.status}">${order.status}</span>
                </div>
                
                <div class="order-details">
                    <div class="customer-info">
                        <strong>Customer:</strong> ${order.billing?.first_name || ''} ${order.billing?.last_name || ''}
                        <br><strong>Email:</strong> ${order.billing?.email || 'N/A'}
                    </div>
                    
                    <div class="order-info">
                        <strong>Total:</strong> $${order.total || '0.00'}
                        <br><strong>Date:</strong> ${new Date(order.date_created).toLocaleDateString()}
                    </div>
                </div>
                
                ${trackingInfo.tracking_number ? `
                    <div class="tracking-info">
                        <strong>Tracking:</strong> ${trackingInfo.tracking_number}
                        <br><strong>Carrier:</strong> ${trackingInfo.carrier || 'Unknown'}
                        ${trackingInfo.tracking_url ? `<br><a href="${trackingInfo.tracking_url}" target="_blank" class="tracking-link">Track Package</a>` : ''}
                    </div>
                ` : ''}
                
                <div class="order-actions">
                    <a href="${trackingInfo.woo_commerce_url || '#'}" target="_blank" class="action-link">View in WooCommerce</a>
                </div>
            </div>
        `;
        
        this.hideLoading();
    }

    displayOrdersList(orders) {
        const resultsContainer = document.getElementById('results');
        
        if (orders.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No orders found</div>';
            this.hideLoading();
            return;
        }
        
        const ordersHtml = orders.map(order => `
            <div class="order-item" onclick="app.getOrderById(${order.id})">
                <div class="order-item-header">
                    <span class="order-id">#${order.id}</span>
                    <span class="status ${order.status}">${order.status}</span>
                </div>
                <div class="order-item-details">
                    <div>${order.billing?.first_name || ''} ${order.billing?.last_name || ''}</div>
                    <div class="order-total">$${order.total || '0.00'}</div>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = `
            <div class="orders-list">
                <h3>Orders (${orders.length})</h3>
                ${ordersHtml}
            </div>
        `;
        
        this.hideLoading();
    }

    displayTrackingOrders(orders) {
        const resultsContainer = document.getElementById('results');
        
        if (orders.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No orders with tracking found</div>';
            this.hideLoading();
            return;
        }
        
        const ordersHtml = orders.map(order => `
            <div class="order-item tracking-item" onclick="app.getOrderById(${order.id})">
                <div class="order-item-header">
                    <span class="order-id">#${order.id}</span>
                    <span class="status ${order.status}">${order.status}</span>
                </div>
                <div class="order-item-details">
                    <div>${order.customer?.name || 'Unknown'}</div>
                    <div class="tracking-number">${order.tracking?.tracking_number || 'No tracking'}</div>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = `
            <div class="orders-list">
                <h3>Orders with Tracking (${orders.length})</h3>
                ${ordersHtml}
            </div>
        `;
        
        this.hideLoading();
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('error').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        const errorElement = document.getElementById('error');
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        this.hideLoading();
    }

    showSuccess(message) {
        const resultsContainer = document.getElementById('results');
        resultsContainer.innerHTML = `<div class="success-message">${message}</div>`;
        this.hideLoading();
    }

    loadInitialData() {
        // Load initial data when Missive is ready
        this.getRecentOrders();
    }
}

// Initialize the app
const app = new MissWooApp(); 