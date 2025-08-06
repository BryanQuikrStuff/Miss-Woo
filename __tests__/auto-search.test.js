/**
 * Auto-Search Functionality Tests
 * Tests for the automatic search feature that triggers when emails are focused
 */

// Mock Missive API
const mockMissiveAPI = {
  on: jest.fn(),
  getCurrentEmail: jest.fn(),
  getCurrentThread: jest.fn()
};

// Mock DOM elements
document.body.innerHTML = `
  <div id="app">
    <div class="search-section">
      <input type="text" id="orderSearch" />
      <button id="searchBtn">Search</button>
    </div>
    <div id="results"></div>
    <div id="loading" class="hidden">Loading...</div>
    <div id="error" class="hidden"></div>
  </div>
`;

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Auto-Search Functionality', () => {
  let app;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock window.Missive
    window.Missive = mockMissiveAPI;
    
    // Mock successful API responses
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });
  });

  afterEach(() => {
    // Clean up
    if (app && app.searchDebounceTimer) {
      clearTimeout(app.searchDebounceTimer);
    }
  });

  describe('Email Extraction', () => {
    test('should extract email from data object', () => {
      // Import the app class (you'll need to adjust the import path)
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      const testData = {
        email: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Order inquiry from customer@example.com'
      };

      const email = app.extractEmailFromData(testData);
      expect(email).toBe('test@example.com');
    });

    test('should extract email from text content', () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      const testData = {
        text: 'Please contact customer@example.com for order details'
      };

      const email = app.extractEmailFromData(testData);
      expect(email).toBe('customer@example.com');
    });

    test('should return null for invalid data', () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      const email = app.extractEmailFromData(null);
      expect(email).toBeNull();
    });
  });

  describe('Email String Extraction', () => {
    test('should extract valid email from string', () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      const email = app.extractEmailFromString('Contact us at test@example.com');
      expect(email).toBe('test@example.com');
    });

    test('should handle multiple emails and return first one', () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      const email = app.extractEmailFromString('Email1: first@example.com Email2: second@example.com');
      expect(email).toBe('first@example.com');
    });

    test('should return null for invalid email', () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      const email = app.extractEmailFromString('This is not an email');
      expect(email).toBeNull();
    });
  });

  describe('Auto-Search Configuration', () => {
    test('should have auto-search enabled by default', () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      expect(app.autoSearchEnabled).toBe(true);
    });

    test('should hide search button when auto-search is enabled', () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      const searchBtn = document.getElementById('searchBtn');
      const searchInput = document.getElementById('orderSearch');
      
      // Simulate the bindEvents method
      app.bindEvents();
      
      expect(searchBtn.style.display).toBe('none');
      expect(searchInput.style.display).toBe('none');
    });
  });

  describe('Debouncing', () => {
    test('should debounce multiple rapid email focus events', async () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      // Mock the performAutoSearch method
      app.performAutoSearch = jest.fn();
      
      // Simulate rapid email focus events
      const testData = { email: 'test@example.com' };
      
      app.handleEmailFocus(testData);
      app.handleEmailFocus(testData);
      app.handleEmailFocus(testData);
      
      // Wait for debounce timer
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should only be called once due to debouncing
      expect(app.performAutoSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Duplicate Search Prevention', () => {
    test('should prevent duplicate searches for same email', async () => {
      const { MissWooApp } = require('../src/app.js');
      app = new MissWooApp();
      
      // Mock the performAutoSearch method
      app.performAutoSearch = jest.fn();
      
      const testData = { email: 'test@example.com' };
      
      // First search
      await app.extractAndSearchEmail(testData);
      expect(app.performAutoSearch).toHaveBeenCalledWith('test@example.com');
      
      // Reset mock
      app.performAutoSearch.mockClear();
      
      // Second search with same email
      await app.extractAndSearchEmail(testData);
      expect(app.performAutoSearch).not.toHaveBeenCalled();
    });
  });
}); 