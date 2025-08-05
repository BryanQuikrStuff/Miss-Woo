const WooCommerceAPI = require('../lib/woocommerce');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('WooCommerceAPI', () => {
  let api;
  let mockAxiosInstance;
  
  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    
    // Mock axios.create to return our mock instance
    axios.create.mockReturnValue(mockAxiosInstance);
    
    // Create a new instance before each test
    api = new WooCommerceAPI();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should return success when connection is successful', async () => {
      // Mock successful response
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: [{ id: 1, name: 'Test Product' }] 
      });

      const result = await api.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('WooCommerce API connection successful');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products');
    });

    it('should return failure when connection fails', async () => {
      // Mock failed response
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await api.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('WooCommerce API connection failed');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products');
    });
  });

  describe('getProducts', () => {
    it('should fetch products successfully', async () => {
      const mockProducts = [
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' }
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockProducts });

      const result = await api.getProducts();
      
      expect(result).toEqual(mockProducts);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products', { params: {} });
    });

    it('should throw error when fetching products fails', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getProducts()).rejects.toThrow('Failed to fetch products: Network error');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products', { params: {} });
    });
  });
});