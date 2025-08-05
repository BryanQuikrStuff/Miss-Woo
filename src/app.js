// Miss-Woo Frontend Application
class MissWooApp {
  constructor() {
    // WooCommerce REST API v3 endpoint
    this.apiBaseUrl = "https://quikrstuff.com/wp-json/wc/v3";
    this.consumerKey = "ck_285852a66ac9cf16db7723e1d6deda54937a8a03";
    this.consumerSecret = "cs_3211f905108b717426e6b6a63613147b66993333";
    this.siteUrl = "https://quikrstuff.com";
    
    // Store all matched orders
    this.allOrders = [];
    this.currentPage = 1;
    this.ordersPerPage = 5;
    
    // Initialize
    this.init();
  }

  async init() {
    console.log("Initializing application...");
    try {
      await this.bindEvents();
      await this.initializeMissive();
      await this.testConnection();
    } catch (error) {
      console.error("Initialization failed:", error);
      this.showError("Failed to initialize application: " + error.message);
    }
  }

  async bindEvents() {
    console.log("Binding events...");
    try {
      // Search functionality
      const searchBtn = document.getElementById("searchBtn");
      const searchInput = document.getElementById("orderSearch");

      if (!searchBtn || !searchInput) {
        throw new Error("Required DOM elements not found");
      }

      searchBtn.addEventListener("click", () => this.handleSearch());
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleSearch();
      });

      // Load more functionality
      document.addEventListener('click', (e) => {
        if (e.target.id === 'loadMoreBtn') {
          this.loadMoreOrders();
        }
      });

      console.log("Events bound successfully");
    } catch (error) {
      console.error("Error binding events:", error);
      throw error;
    }
  }

  async handleSearch() {
    const searchInput = document.getElementById("orderSearch");
    const searchTerm = searchInput?.value.trim();

    if (!searchTerm) {
      this.showError("Please enter an order ID or customer email");
      return;
    }

    this.showLoading();
    console.log("Searching for:", searchTerm);

    try {
      // Reset pagination
      this.currentPage = 1;
      this.allOrders = [];

      // Check if it's an order ID (numeric)
      if (/^\d+$/.test(searchTerm)) {
        await this.getOrderById(searchTerm);
      } else {
        // Assume it's an email, search orders
        await this.searchOrdersByEmail(searchTerm);
      }
    } catch (error) {
      console.error("Search error:", error);
      this.showError(`Search failed: ${error.message}`);
    }
  }

  async searchOrdersByEmail(email) {
    console.log("Searching orders for email:", email);
    try {
      // Get all orders across multiple pages
      let allFetchedOrders = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore && page <= 5) { // Limit to 5 pages to avoid too many requests
        const billingUrl = this.getAuthenticatedUrl("/orders", {
          search: email,
          per_page: perPage,
          page: page
        });
        console.log(`Searching page ${page} with URL:`, billingUrl);
        
        const pageOrders = await this.makeRequest(billingUrl);
        if (!pageOrders || pageOrders.length === 0) {
          hasMore = false;
        } else {
          allFetchedOrders = allFetchedOrders.concat(pageOrders);
          page++;
        }
      }

      console.log('Total orders found:', allFetchedOrders.length);
      
      if (allFetchedOrders.length === 0) {
        this.showError(`No orders found for email: ${email}`);
        return;
      }

      // Filter orders to match the email exactly and sort by date
      this.allOrders = allFetchedOrders
        .filter(order => {
          const orderEmail = order.billing?.email?.toLowerCase();
          const searchEmail = email.toLowerCase();
          const matches = orderEmail === searchEmail;
          console.log(`Checking order ${order.id}: ${orderEmail} against ${searchEmail}: ${matches}`);
          return matches;
        })
        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

      console.log("Total matching orders:", this.allOrders.length);
      this.displayOrdersList();
    } catch (error) {
      console.error("Search by email error:", error);
      this.showError(`Failed to search orders for ${email}: ${error.message}`);
    }
  }

  loadMoreOrders() {
    this.currentPage++;
    this.displayOrdersList();
  }

  // Helper method to create authenticated request URL
  getAuthenticatedUrl(endpoint, params = {}) {
    try {
      const url = new URL(`${this.apiBaseUrl}${endpoint}`);
      url.searchParams.append("consumer_key", this.consumerKey);
      url.searchParams.append("consumer_secret", this.consumerSecret);

      // Add any additional parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.log("Generated URL:", url.toString());
      return url.toString();
    } catch (error) {
      console.error("URL creation error:", error);
      throw new Error("Failed to create API URL: " + error.message);
    }
  }

  // Helper method for making API requests
  async makeRequest(url, options = {}) {
    console.log("Making request to:", url);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options.headers,
        },
        mode: "cors",
      });

      const responseText = await response.text();
      console.log("Raw response:", responseText);

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, response: ${responseText}`
        );
      }

      const data = JSON.parse(responseText);
      console.log("Parsed API Response:", data);
      return data;
    } catch (error) {
      console.error("API Request failed:", error);
      throw error;
    }
  }

  async getOrderById(orderId) {
    console.log("Fetching order:", orderId);
    try {
      const url = this.getAuthenticatedUrl(`/orders/${orderId}`);
      console.log("Request URL:", url);

      const order = await this.makeRequest(url);
      console.log("Found order:", order);

      this.allOrders = [order];
      this.displayOrdersList();
    } catch (error) {
      console.error("Get order error:", error);
      this.showError(`Failed to fetch order ${orderId}: ${error.message}`);
    }
  }

  async testConnection() {
    this.showLoading();
    console.log("Testing API connection...");
    try {
      const url = this.getAuthenticatedUrl("/products", { per_page: 1 });
      const response = await this.makeRequest(url);
      console.log("Connection test successful:", response);
      this.showSuccess("✅ WooCommerce API connection successful!");
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      this.showError(`❌ API connection failed: ${error.message}`);
      return false;
    }
  }

  displayOrdersList() {
    const resultsContainer = document.getElementById("results");

    if (!this.allOrders || this.allOrders.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No orders found</div>';
      this.hideLoading();
      return;
    }

    // Calculate slice for current page
    const startIndex = 0;
    const endIndex = this.currentPage * this.ordersPerPage;
    const ordersToShow = this.allOrders.slice(startIndex, endIndex);
    const hasMoreOrders = this.allOrders.length > endIndex;

    const ordersHtml = ordersToShow
      .map((order) => {
        const date = new Date(order.date_created).toLocaleDateString();
        const name =
          `${order.billing?.first_name || ""} ${
            order.billing?.last_name || ""
          }`.trim() || "No name";
        const orderUrl = `${this.siteUrl}/wp-admin/post.php?post=${order.id}&action=edit`;

        return `
          <div class="order-item">
            <a href="${orderUrl}" target="_blank" class="order-summary">
              <span class="order-date">${date}</span>
              <span class="order-id">#${order.id}</span>
              <span class="customer-name">${name}</span>
            </a>
          </div>
        `;
      })
      .join("");

    resultsContainer.innerHTML = `
      <style>
        .orders-list {
          padding: 10px;
        }
        .order-item {
          padding: 8px;
          margin: 5px 0;
          border: 1px solid #ddd;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        .order-item:hover {
          background-color: #f5f5f5;
        }
        .order-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: inherit;
        }
        .order-date {
          color: #666;
          font-size: 0.9em;
          min-width: 80px;
        }
        .order-id {
          font-weight: bold;
          color: #333;
        }
        .customer-name {
          flex-grow: 1;
          text-align: right;
        }
        .list-header {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          border-bottom: 2px solid #eee;
          margin-bottom: 10px;
          font-weight: bold;
          gap: 10px;
        }
        .total-count {
          text-align: center;
          padding: 10px;
          font-weight: bold;
          color: #666;
          border-bottom: 1px solid #eee;
          margin-bottom: 10px;
        }
        .load-more {
          display: block;
          width: 100%;
          padding: 10px;
          margin-top: 10px;
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          text-align: center;
          color: #333;
        }
        .load-more:hover {
          background-color: #e0e0e0;
        }
      </style>
      <div class="orders-list">
        <div class="total-count">Found ${this.allOrders.length} orders</div>
        <div class="list-header">
          <span>Date</span>
          <span>Order #</span>
          <span>Customer</span>
        </div>
        ${ordersHtml}
        ${hasMoreOrders ? '<button id="loadMoreBtn" class="load-more">Load More Orders</button>' : ''}
      </div>
    `;

    this.hideLoading();
  }

  showLoading() {
    const loading = document.getElementById("loading");
    const error = document.getElementById("error");
    if (loading) loading.classList.remove("hidden");
    if (error) error.classList.add("hidden");
  }

  hideLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.classList.add("hidden");
  }

  showError(message) {
    const errorElement = document.getElementById("error");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("hidden");
    }
    this.hideLoading();
  }

  showSuccess(message) {
    const resultsContainer = document.getElementById("results");
    if (resultsContainer) {
      resultsContainer.innerHTML = `<div class="success-message">${message}</div>`;
    }
    this.hideLoading();
  }

  initializeMissive() {
    // Initialize Missive iframe integration
    if (window.Missive) {
      window.Missive.on("ready", () => {
        console.log("Missive iframe ready");
      });
    }
  }
}

// Initialize the app and handle any errors
try {
  console.log("Starting application...");
  window.app = new MissWooApp();
} catch (error) {
  console.error("Failed to start application:", error);
  const errorDiv = document.getElementById("error");
  if (errorDiv) {
    errorDiv.textContent = "Failed to start application: " + error.message;
    errorDiv.classList.remove("hidden");
  }
}