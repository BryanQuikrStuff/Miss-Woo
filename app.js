/**
 * WooCommerce Orders Integration for Missive
 * 
 * This integration fetches and displays WooCommerce order data for email senders
 * in Missive conversations. It uses the Missive JavaScript API and WooCommerce REST API.
 */

// Configuration - Update these with your WooCommerce store details
const WOOCOMMERCE_CONFIG = {
    baseUrl: 'https://your-store.com', // Replace with your WooCommerce store URL
    consumerKey: 'ck_your_consumer_key', // Replace with your consumer key
    consumerSecret: 'cs_your_consumer_secret', // Replace with your consumer secret
    apiVersion: 'v3'
};

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_PREFIX = 'wc_orders_';

// Global state
let currentEmail = null;
let currentOrders = [];
let selectedOrderId = null;

/**
 * Initialize the Missive integration
 */
function initMissive() {
    console.log('Initializing Missive WooCommerce integration...');
    
    // Register for conversation changes
    Missive.on('change:conversations', handleConversationChange);
    
    // Initial load - get current conversations
    handleConversationChange();
}

/**
 * Handle conversation changes in Missive
 */
async function handleConversationChange() {
    try {
        const conversations = Missive.getConversations();
        console.log('Conversations changed:', conversations);
        
        // Reset state
        clearContent();
        currentEmail = null;
        currentOrders = [];
        selectedOrderId = null;
        
        if (!conversations || conversations.length === 0) {
            showInfo('No conversation selected', 'Please select a conversation to view order details.');
            return;
        }
        
        if (conversations.length > 1) {
            showMultipleConversations();
            return;
        }
        
        // Fetch detailed conversation data
        const conversationIds = conversations.map(c => c.id);
        const detailedConversations = await Missive.fetchConversations(conversationIds);
        
        if (detailedConversations && detailedConversations.length > 0) {
            const conversation = detailedConversations[0];
            const email = extractEmailFromConversation(conversation);
            
            if (email) {
                currentEmail = email;
                await loadOrdersForEmail(email);
            } else {
                showError('Unable to extract email from conversation');
            }
        }
    } catch (error) {
        console.error('Error handling conversation change:', error);
        showError('Failed to load conversation data: ' + error.message);
    }
}

/**
 * Extract email address from conversation
 */
function extractEmailFromConversation(conversation) {
    try {
        if (conversation.latest_message && 
            conversation.latest_message.from_field && 
            conversation.latest_message.from_field.address) {
            return conversation.latest_message.from_field.address;
        }
        
        // Fallback: try to extract from participants
        if (conversation.contacts && conversation.contacts.length > 0) {
            for (const contact of conversation.contacts) {
                if (contact.emails && contact.emails.length > 0) {
                    return contact.emails[0];
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting email:', error);
        return null;
    }
}

/**
 * Load orders for a specific email
 */
async function loadOrdersForEmail(email) {
    try {
        showLoading();
        
        // Check cache first
        const cachedOrders = await getCachedOrders(email);
        if (cachedOrders) {
            console.log('Using cached orders for:', email);
            currentOrders = cachedOrders;
            renderOrdersList(cachedOrders);
            showMainContent(email);
            return;
        }
        
        // Fetch from WooCommerce API
        console.log('Fetching orders for email:', email);
        const orders = await fetchOrdersByEmail(email);
        
        if (orders && orders.length > 0) {
            currentOrders = orders;
            await cacheOrders(email, orders);
            renderOrdersList(orders);
            showMainContent(email);
        } else {
            showNoOrders();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Failed to load orders: ' + error.message);
    }
}

/**
 * Fetch orders from WooCommerce API by email
 */
async function fetchOrdersByEmail(email) {
    const url = `${WOOCOMMERCE_CONFIG.baseUrl}/wp-json/wc/${WOOCOMMERCE_CONFIG.apiVersion}/orders`;
    const params = new URLSearchParams({
        email: email,
        per_page: 100, // Adjust as needed
        orderby: 'date',
        order: 'desc'
    });
    
    const credentials = btoa(`${WOOCOMMERCE_CONFIG.consumerKey}:${WOOCOMMERCE_CONFIG.consumerSecret}`);
    
    const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
}

/**
 * Fetch detailed order information
 */
async function fetchOrderDetails(orderId) {
    const url = `${WOOCOMMERCE_CONFIG.baseUrl}/wp-json/wc/${WOOCOMMERCE_CONFIG.apiVersion}/orders/${orderId}`;
    const credentials = btoa(`${WOOCOMMERCE_CONFIG.consumerKey}:${WOOCOMMERCE_CONFIG.consumerSecret}`);
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
}

/**
 * Render the orders list
 */
function renderOrdersList(orders) {
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = '';
    
    orders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        orderItem.onclick = () => handleOrderClick(order.id);
        
        const date = new Date(order.date_created).toLocaleDateString();
        const total = order.total;
        const currency = order.currency;
        const status = order.status;
        
        orderItem.innerHTML = `
            <div class="order-header">
                <span class="order-id">#${order.id}</span>
                <span class="order-status status-${status}">${status.toUpperCase()}</span>
            </div>
            <div class="order-meta">
                <span class="order-date">${date}</span>
                <span class="order-total">${currency} ${total}</span>
            </div>
        `;
        
        ordersList.appendChild(orderItem);
    });
}

/**
 * Handle order item click
 */
async function handleOrderClick(orderId) {
    try {
        // Update UI to show selection
        document.querySelectorAll('.order-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.currentTarget.classList.add('selected');
        
        selectedOrderId = orderId;
        
        // Show loading in details panel
        const detailsPanel = document.getElementById('order-details');
        detailsPanel.innerHTML = '<div class="loading-details"><div class="spinner"></div><p>Loading order details...</p></div>';
        
        // Fetch and render order details
        const orderDetails = await fetchOrderDetails(orderId);
        renderOrderDetails(orderDetails);
    } catch (error) {
        console.error('Error loading order details:', error);
        const detailsPanel = document.getElementById('order-details');
        detailsPanel.innerHTML = `<div class="error-details">Error loading order details: ${error.message}</div>`;
    }
}

/**
 * Render detailed order information
 */
function renderOrderDetails(order) {
    const detailsPanel = document.getElementById('order-details');
    
    const date = new Date(order.date_created).toLocaleDateString();
    const shippingAddress = order.shipping || {};
    
    // Generate line items HTML
    const lineItemsHtml = order.line_items.map(item => `
        <div class="line-item">
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-sku">${item.sku || 'N/A'}</span>
            </div>
            <div class="item-quantity">Qty: ${item.quantity}</div>
            <div class="item-total">${order.currency} ${item.total}</div>
        </div>
    `).join('');
    
    // Generate shipping address HTML
    const shippingHtml = `
        <div class="shipping-address">
            <h4>Shipping Address</h4>
            <div class="address">
                ${shippingAddress.first_name || ''} ${shippingAddress.last_name || ''}<br>
                ${shippingAddress.address_1 || ''}<br>
                ${shippingAddress.address_2 ? shippingAddress.address_2 + '<br>' : ''}
                ${shippingAddress.city || ''}, ${shippingAddress.state || ''} ${shippingAddress.postcode || ''}<br>
                ${shippingAddress.country || ''}
            </div>
        </div>
    `;
    
    // Extract tracking information (adjust based on your tracking setup)
    const trackingInfo = extractTrackingInfo(order);
    const trackingHtml = trackingInfo ? `
        <div class="tracking-info">
            <h4>Tracking Information</h4>
            <div class="tracking-details">
                <strong>Tracking Number:</strong> ${trackingInfo.number}<br>
                <strong>Carrier:</strong> ${trackingInfo.carrier || 'N/A'}<br>
                <strong>Status:</strong> ${trackingInfo.status || order.status}
            </div>
        </div>
    ` : '';
    
    detailsPanel.innerHTML = `
        <div class="order-header-details">
            <h3>Order #${order.id}</h3>
            <div class="order-meta-details">
                <span class="order-date">${date}</span>
                <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>
            </div>
        </div>
        
        <div class="order-section">
            <h4>Items (${order.line_items.length})</h4>
            <div class="line-items">
                ${lineItemsHtml}
            </div>
            <div class="order-total-section">
                <strong>Total: ${order.currency} ${order.total}</strong>
            </div>
        </div>
        
        <div class="order-section">
            ${shippingHtml}
        </div>
        
        ${trackingHtml ? `<div class="order-section">${trackingHtml}</div>` : ''}
    `;
}

/**
 * Extract tracking information from order
 * Adjust this function based on how tracking is stored in your WooCommerce setup
 */
function extractTrackingInfo(order) {
    // Example: Check meta_data for tracking information
    if (order.meta_data && order.meta_data.length > 0) {
        const trackingMeta = order.meta_data.find(meta => 
            meta.key.includes('tracking') || meta.key.includes('shipment')
        );
        
        if (trackingMeta) {
            return {
                number: trackingMeta.value,
                carrier: 'Unknown',
                status: order.status
            };
        }
    }
    
    // Check shipping lines for tracking info
    if (order.shipping_lines && order.shipping_lines.length > 0) {
        const shippingLine = order.shipping_lines[0];
        if (shippingLine.meta_data) {
            const trackingMeta = shippingLine.meta_data.find(meta => 
                meta.key.includes('tracking')
            );
            
            if (trackingMeta) {
                return {
                    number: trackingMeta.value,
                    carrier: shippingLine.method_title,
                    status: order.status
                };
            }
        }
    }
    
    return null;
}

/**
 * Cache management functions
 */
async function cacheOrders(email, orders) {
    try {
        const cacheKey = CACHE_PREFIX + email;
        const cacheData = {
            orders: orders,
            timestamp: Date.now()
        };
        await Missive.storeSet(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error caching orders:', error);
    }
}

async function getCachedOrders(email) {
    try {
        const cacheKey = CACHE_PREFIX + email;
        const cachedData = await Missive.storeGet(cacheKey);
        
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            const age = Date.now() - parsed.timestamp;
            
            if (age < CACHE_DURATION) {
                return parsed.orders;
            }
        }
    } catch (error) {
        console.error('Error getting cached orders:', error);
    }
    
    return null;
}

/**
 * UI State Management Functions
 */
function showLoading() {
    hideAllContainers();
    document.getElementById('loading').style.display = 'block';
}

function showError(message) {
    hideAllContainers();
    document.getElementById('error-text').textContent = message;
    document.getElementById('error').style.display = 'block';
}

function showMultipleConversations() {
    hideAllContainers();
    document.getElementById('multiple-conversations').style.display = 'block';
}

function showNoOrders() {
    hideAllContainers();
    document.getElementById('no-orders').style.display = 'block';
}

function showMainContent(email) {
    hideAllContainers();
    document.getElementById('customer-email').textContent = email;
    document.getElementById('customer-info').textContent = `${currentOrders.length} order(s) found`;
    document.getElementById('main-content').style.display = 'block';
}

function showInfo(title, message) {
    hideAllContainers();
    const container = document.getElementById('no-orders');
    container.querySelector('h3').textContent = title;
    container.querySelector('p').textContent = message;
    container.style.display = 'block';
}

function hideAllContainers() {
    ['loading', 'error', 'multiple-conversations', 'no-orders', 'main-content'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
}

function clearContent() {
    hideAllContainers();
    const ordersList = document.getElementById('orders-list');
    const orderDetails = document.getElementById('order-details');
    
    if (ordersList) ordersList.innerHTML = '';
    if (orderDetails) {
        orderDetails.innerHTML = '<div class="placeholder"><p>Select an order to view details</p></div>';
    }
}

/**
 * Retry function for error state
 */
function retryLoadOrders() {
    if (currentEmail) {
        loadOrdersForEmail(currentEmail);
    } else {
        handleConversationChange();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Missive to be ready
    if (typeof Missive !== 'undefined') {
        initMissive();
    } else {
        // Fallback: wait for Missive to load
        const checkMissive = setInterval(() => {
            if (typeof Missive !== 'undefined') {
                clearInterval(checkMissive);
                initMissive();
            }
        }, 100);
    }
});

// Export functions for global access (for onclick handlers)
window.retryLoadOrders = retryLoadOrders;