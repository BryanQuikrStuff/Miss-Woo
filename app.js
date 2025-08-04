// WooCommerce Integration for Missive
class WooCommerceOrdersApp {
    constructor() {
        this.currentEmail = null;
        this.orders = [];
        this.selectedOrderId = null;
        
        // WooCommerce configuration (these should be set via environment or config)
        this.wooConfig = {
            baseUrl: process.env.WOOCOMMERCE_URL || localStorage.getItem('woo_base_url') || '',
            consumerKey: process.env.WOOCOMMERCE_KEY || localStorage.getItem('woo_consumer_key') || '',
            consumerSecret: process.env.WOOCOMMERCE_SECRET || localStorage.getItem('woo_consumer_secret') || ''
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeMissive();
    }

    bindEvents() {
        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.loadCustomerOrders();
        });

        // Close modal
        document.getElementById('close-details').addEventListener('click', () => {
            this.closeOrderDetails();
        });

        // Close modal on backdrop click
        document.getElementById('order-details').addEventListener('click', (e) => {
            if (e.target.id === 'order-details') {
                this.closeOrderDetails();
            }
        });
    }

    initializeMissive() {
        if (typeof Missive === 'undefined') {
            this.showError('Missive API not available');
            return;
        }

        try {
            // Initialize Missive integration
            Missive.on('change:conversations', (conversations) => {
                this.handleConversationChange(conversations);
            });

            // Get initial conversations
            Missive.fetch('conversations', (conversations) => {
                this.handleConversationChange(conversations);
            });

        } catch (error) {
            console.error('Missive initialization error:', error);
            this.showError('Failed to initialize Missive integration');
        }
    }

    handleConversationChange(conversations) {
        console.log('Conversations changed:', conversations);
        
        // Check if we have exactly one conversation selected
        if (!conversations || conversations.length === 0) {
            this.showNoEmail();
            return;
        }

        if (conversations.length > 1) {
            this.showInfo('Please select a single conversation');
            return;
        }

        const conversation = conversations[0];
        this.extractEmailFromConversation(conversation);
    }

    extractEmailFromConversation(conversation) {
        let email = null;

        try {
            // Try to get email from conversation participants
            if (conversation.users && conversation.users.length > 0) {
                // Find non-team member (customer email)
                const customer = conversation.users.find(user => !user.is_team_member);
                if (customer && customer.email) {
                    email = customer.email;
                }
            }

            // Fallback: try to get from latest message
            if (!email && conversation.latest_message) {
                const message = conversation.latest_message;
                if (message.from_field && message.from_field.address) {
                    email = message.from_field.address;
                }
            }

            // Fallback: extract from subject or body
            if (!email && conversation.subject) {
                const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
                const match = conversation.subject.match(emailRegex);
                if (match) {
                    email = match[1];
                }
            }

        } catch (error) {
            console.error('Error extracting email:', error);
        }

        if (email) {
            this.currentEmail = email;
            this.loadCustomerOrders();
        } else {
            this.showNoEmail();
        }
    }

    async loadCustomerOrders() {
        if (!this.currentEmail) {
            this.showNoEmail();
            return;
        }

        if (!this.isConfigured()) {
            this.showConfigRequired();
            return;
        }

        this.showLoading();

        try {
            const orders = await this.fetchWooCommerceOrders(this.currentEmail);
            this.orders = orders;
            this.displayOrders();
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showError(error.message || 'Failed to load customer orders');
        }
    }

    async fetchWooCommerceOrders(email) {
        const { baseUrl, consumerKey, consumerSecret } = this.wooConfig;
        
        if (!baseUrl || !consumerKey || !consumerSecret) {
            throw new Error('WooCommerce configuration incomplete');
        }

        // Create basic auth header
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        
        const url = `${baseUrl}/wp-json/wc/v3/orders?customer=${encodeURIComponent(email)}&per_page=50&orderby=date&order=desc`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('WooCommerce authentication failed');
            } else if (response.status === 404) {
                throw new Error('WooCommerce API endpoint not found');
            } else {
                throw new Error(`WooCommerce API error: ${response.status}`);
            }
        }

        const orders = await response.json();
        return Array.isArray(orders) ? orders : [];
    }

    async fetchOrderDetails(orderId) {
        const { baseUrl, consumerKey, consumerSecret } = this.wooConfig;
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        
        const url = `${baseUrl}/wp-json/wc/v3/orders/${orderId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch order details: ${response.status}`);
        }

        return await response.json();
    }

    displayOrders() {
        const container = document.getElementById('orders-container');
        const customerInfo = document.getElementById('customer-info');
        const orderCount = document.getElementById('order-count');
        const ordersList = document.getElementById('orders-list');

        if (this.orders.length === 0) {
            this.showInfo('No orders found for this customer');
            return;
        }

        // Update customer info
        customerInfo.textContent = `Orders for ${this.currentEmail}`;
        orderCount.textContent = `${this.orders.length} order${this.orders.length !== 1 ? 's' : ''}`;

        // Clear previous orders
        ordersList.innerHTML = '';

        // Render orders
        this.orders.forEach(order => {
            const orderElement = this.createOrderElement(order);
            ordersList.appendChild(orderElement);
        });

        this.hideAllStates();
        container.style.display = 'block';
    }

    createOrderElement(order) {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-item';
        orderDiv.dataset.orderId = order.id;
        
        const statusClass = this.getStatusClass(order.status);
        const formattedDate = new Date(order.date_created).toLocaleDateString();
        const total = parseFloat(order.total).toFixed(2);

        orderDiv.innerHTML = `
            <div class="order-header">
                <div class="order-id">#${order.number}</div>
                <div class="order-status ${statusClass}">${order.status}</div>
            </div>
            <div class="order-details">
                <div class="order-date">${formattedDate}</div>
                <div class="order-total">$${total}</div>
            </div>
            <div class="order-items-preview">
                ${order.line_items.slice(0, 2).map(item => `
                    <span class="item-name">${item.name}</span>
                `).join(', ')}
                ${order.line_items.length > 2 ? `<span class="more-items">+${order.line_items.length - 2} more</span>` : ''}
            </div>
        `;

        orderDiv.addEventListener('click', () => {
            this.showOrderDetails(order.id);
        });

        return orderDiv;
    }

    async showOrderDetails(orderId) {
        try {
            this.selectedOrderId = orderId;
            const order = await this.fetchOrderDetails(orderId);
            this.renderOrderDetails(order);
        } catch (error) {
            console.error('Error loading order details:', error);
            this.showError('Failed to load order details');
        }
    }

    renderOrderDetails(order) {
        const modal = document.getElementById('order-details');
        const title = document.getElementById('order-details-title');
        const content = document.getElementById('order-details-content');

        title.textContent = `Order #${order.number}`;

        const formattedDate = new Date(order.date_created).toLocaleDateString();
        const statusClass = this.getStatusClass(order.status);

        content.innerHTML = `
            <div class="order-summary">
                <div class="summary-row">
                    <span class="label">Status:</span>
                    <span class="order-status ${statusClass}">${order.status}</span>
                </div>
                <div class="summary-row">
                    <span class="label">Date:</span>
                    <span>${formattedDate}</span>
                </div>
                <div class="summary-row">
                    <span class="label">Total:</span>
                    <span class="total">$${parseFloat(order.total).toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span class="label">Payment Method:</span>
                    <span>${order.payment_method_title || 'N/A'}</span>
                </div>
            </div>

            <div class="order-items">
                <h5>Items</h5>
                <div class="items-list">
                    ${order.line_items.map(item => `
                        <div class="item">
                            <div class="item-info">
                                <div class="item-name">${item.name}</div>
                                <div class="item-meta">
                                    Qty: ${item.quantity} × $${parseFloat(item.price).toFixed(2)}
                                </div>
                            </div>
                            <div class="item-total">$${parseFloat(item.total).toFixed(2)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${order.shipping ? `
                <div class="shipping-info">
                    <h5>Shipping</h5>
                    <div class="address">
                        ${order.shipping.first_name} ${order.shipping.last_name}<br>
                        ${order.shipping.address_1}<br>
                        ${order.shipping.address_2 ? order.shipping.address_2 + '<br>' : ''}
                        ${order.shipping.city}, ${order.shipping.state} ${order.shipping.postcode}<br>
                        ${order.shipping.country}
                    </div>
                    <div class="shipping-cost">
                        Shipping: $${parseFloat(order.shipping_total).toFixed(2)}
                    </div>
                </div>
            ` : ''}

            <div class="order-totals">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>$${parseFloat(order.total - order.total_tax - order.shipping_total).toFixed(2)}</span>
                </div>
                ${order.shipping_total > 0 ? `
                    <div class="total-row">
                        <span>Shipping:</span>
                        <span>$${parseFloat(order.shipping_total).toFixed(2)}</span>
                    </div>
                ` : ''}
                ${order.total_tax > 0 ? `
                    <div class="total-row">
                        <span>Tax:</span>
                        <span>$${parseFloat(order.total_tax).toFixed(2)}</span>
                    </div>
                ` : ''}
                <div class="total-row total">
                    <span>Total:</span>
                    <span>$${parseFloat(order.total).toFixed(2)}</span>
                </div>
            </div>
        `;

        modal.style.display = 'block';
    }

    closeOrderDetails() {
        document.getElementById('order-details').style.display = 'none';
        this.selectedOrderId = null;
    }

    getStatusClass(status) {
        const statusMap = {
            'pending': 'status-pending',
            'processing': 'status-processing',
            'on-hold': 'status-on-hold',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled',
            'refunded': 'status-refunded',
            'failed': 'status-failed'
        };
        return statusMap[status] || 'status-default';
    }

    isConfigured() {
        const { baseUrl, consumerKey, consumerSecret } = this.wooConfig;
        return !!(baseUrl && consumerKey && consumerSecret);
    }

    // UI State Management
    hideAllStates() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        document.getElementById('no-email').style.display = 'none';
        document.getElementById('config-required').style.display = 'none';
        document.getElementById('orders-container').style.display = 'none';
    }

    showLoading() {
        this.hideAllStates();
        document.getElementById('loading').style.display = 'block';
    }

    showError(message) {
        this.hideAllStates();
        document.getElementById('error-message').textContent = message;
        document.getElementById('error').style.display = 'block';
    }

    showNoEmail() {
        this.hideAllStates();
        document.getElementById('no-email').style.display = 'block';
    }

    showConfigRequired() {
        this.hideAllStates();
        document.getElementById('config-required').style.display = 'block';
    }

    showInfo(message) {
        this.hideAllStates();
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info-container';
        infoDiv.innerHTML = `
            <div class="info-icon">ℹ️</div>
            <p>${message}</p>
        `;
        document.getElementById('app').appendChild(infoDiv);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WooCommerceOrdersApp();
});

// Handle configuration via postMessage (for external configuration)
window.addEventListener('message', (event) => {
    if (event.data.type === 'woocommerce-config') {
        const { baseUrl, consumerKey, consumerSecret } = event.data;
        localStorage.setItem('woo_base_url', baseUrl);
        localStorage.setItem('woo_consumer_key', consumerKey);
        localStorage.setItem('woo_consumer_secret', consumerSecret);
        
        // Reload the app with new configuration
        location.reload();
    }
});