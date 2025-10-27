// Missive JS API variant (vJS4.00)
// Complete implementation with full MissWooApp functionality

// This file assumes index-missive-js.html loads missive.js and src/config.js first.

class MissiveJSBridge {
  constructor() {
    this.isReady = false;
    this.app = null;
    this.init();
  }

  init() {
    console.log('🚀 Initializing MissiveJSBridge...');
    
    // Force version badge to vJS4.00 immediately
        this.setBadge('vJS4.00');
    console.log('🔧 Set initial version badge to vJS4.00');

    // Initialize the full MissWooApp first
    this.initializeApp();

    // Enhanced initialization with better error handling
    const initializeMissive = () => {
      console.log('🔧 Checking for Missive API...');
      console.log('🔧 window.Missive available:', !!window.Missive);
      
      if (!window.Missive) {
        console.log('⏳ Missive API not available yet, waiting...');
        return false;
      }

      console.log('✅ Missive API detected, binding events...');
      this.bindMissiveEvents();
      return true;
    };

    // Try immediate initialization
    if (!initializeMissive()) {
      // Wait for Missive script to be present with timeout
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds total
      
      const checkInterval = setInterval(() => {
        attempts++;
        console.log(`🔧 Attempt ${attempts}/${maxAttempts} to find Missive API...`);
        
        if (initializeMissive()) {
          clearInterval(checkInterval);
        } else if (attempts >= maxAttempts) {
          console.error('❌ Missive API not found after 5 seconds');
          clearInterval(checkInterval);
          
          // Fallback: try to bind events anyway in case Missive loads later
          setTimeout(() => {
            console.log('🔄 Fallback: Attempting to bind events...');
            this.bindMissiveEvents();
          }, 2000);
        }
      }, 200);
    }
  }

  setBadge(text) {
    const el = document.querySelector('.version-badge');
    if (el) {
      el.textContent = text;
      console.log(`🔧 Version badge set to: ${text}`);
      console.log(`🔧 Version badge element found:`, el);
      console.log(`🔧 Version badge current text:`, el.textContent);
    } else {
      console.log('❌ Version badge element not found');
      console.log('❌ Available elements with "version":', document.querySelectorAll('[class*="version"]'));
      console.log('❌ Available elements with "badge":', document.querySelectorAll('[class*="badge"]'));
    }
  }

  initializeApp() {
    try {
      console.log('🔧 Initializing MissWooApp...');
      console.log('🔧 window.config available:', !!window.config);
      console.log('🔧 window.MissWooApp available:', !!window.MissWooApp);
      
      if (window.config && window.MissWooApp) {
        console.log('🔧 Creating MissWooApp instance...');
        this.app = new MissWooApp(window.config);
        console.log('🔧 MissWooApp instance created:', !!this.app);
        
        // Override version badge to vJS4.00 once app updates header
        setTimeout(() => this.setBadge('vJS4.00'), 300);
        
        // Additional aggressive version setting to ensure it shows
        setTimeout(() => this.setBadge('vJS4.00'), 1000);
        setTimeout(() => this.setBadge('vJS4.00'), 2000);
        setTimeout(() => this.setBadge('vJS4.00'), 3000);
        setTimeout(() => this.setBadge('vJS4.00'), 5000);
        
        // Override MissWooApp's version setting by patching the method
        if (this.app && this.app.updateHeaderWithVersion) {
          const originalUpdateHeader = this.app.updateHeaderWithVersion.bind(this.app);
          this.app.updateHeaderWithVersion = () => {
            originalUpdateHeader();
            // Force our version after the app updates it
            setTimeout(() => this.setBadge('vJS4.00'), 100);
          };
        }
        
        // Bind manual search events
        this.bindManualSearchEvents();
        
        console.log('✅ MissWooApp initialization complete');
      } else {
        console.log('❌ Missing dependencies for MissWooApp initialization');
        console.log('❌ window.config:', !!window.config);
        console.log('❌ window.MissWooApp:', !!window.MissWooApp);
        
        // Retry initialization after a delay
        setTimeout(() => {
          console.log('🔄 Retrying MissWooApp initialization...');
          this.initializeApp();
        }, 1000);
      }
    } catch (e) {
      console.error('❌ Failed to initialize MissWooApp:', e);
      
      // Retry initialization after a delay
      setTimeout(() => {
        console.log('🔄 Retrying MissWooApp initialization after error...');
        this.initializeApp();
      }, 1000);
    }
  }

  bindManualSearchEvents() {
    // Bind search button click
    const searchButton = document.getElementById('searchBtn');
    if (searchButton) {
      searchButton.onclick = () => {
        console.log('🔍 Manual search button clicked');
        if (this.app?.handleSearch) {
          this.app.handleSearch();
        }
      };
    }

    // Bind search input enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          console.log('🔍 Manual search enter key pressed');
          if (this.app?.handleSearch) {
            this.app.handleSearch();
          }
        }
      };
    }

    // Add debug methods to window for testing
    window.MissWooDebug = {
      triggerTestSearch: (email) => {
        console.log('🧪 Debug: Triggering test search for:', email);
        if (this.app && this.app.performAutoSearch) {
          this.app.performAutoSearch(email);
        } else {
          console.error('❌ App not available for test search');
        }
      },
      checkMissiveAPI: () => {
        console.log('🧪 Debug: Missive API status:', {
          available: !!window.Missive,
          ready: this.isReady,
          app: !!this.app
        });
        return {
          missiveAvailable: !!window.Missive,
          bridgeReady: this.isReady,
          appAvailable: !!this.app
        };
      },
      forceEventTest: () => {
        console.log('🧪 Debug: Testing event handling...');
        if (this.app && this.app.performAutoSearch) {
          // Simulate an email event
          const testData = {
            email: 'test@example.com',
            from: { email: 'test@example.com', name: 'Test User' }
          };
          console.log('🧪 Simulating email event with:', testData);
          this.app.performAutoSearch('test@example.com');
        }
      },
      testEmailExtraction: (testData) => {
        console.log('🧪 Debug: Testing email extraction with:', testData);
        if (this.app && this.app.extractEmailFromData) {
          const email = this.app.extractEmailFromData(testData);
          console.log('🧪 Extracted email:', email);
          return email;
        } else {
          console.error('❌ App not available for email extraction test');
        }
      },
      getCurrentConversation: async () => {
        console.log('🧪 Debug: Getting current conversation...');
        if (window.Missive && Missive.getCurrentConversation) {
          try {
            const conv = await Missive.getCurrentConversation();
            console.log('🧪 Current conversation:', conv);
            return conv;
          } catch (error) {
            console.error('❌ Error getting current conversation:', error);
          }
        } else {
          console.error('❌ Missive.getCurrentConversation not available');
        }
      },
      testCurrentEmail: async () => {
        console.log('🧪 Debug: Testing email extraction with current conversation...');
        try {
          const conv = await this.getCurrentConversation();
          if (conv) {
            const email = this.testEmailExtraction(conv);
            console.log('🧪 Final extracted email:', email);
            return email;
          }
        } catch (error) {
          console.error('❌ Error in testCurrentEmail:', error);
        }
        return null;
      },
      testAllEvents: () => {
        console.log('🧪 Debug: Testing all Missive events...');
        const events = ['email:focus', 'email:open', 'thread:focus', 'conversation:focus', 'conversation:open', 'change:conversations'];
        events.forEach(event => {
          console.log(`🧪 ${event} handler registered:`, typeof window.Missive?.on === 'function');
        });
        return events;
      },
      simulateEmailEvent: (email) => {
        console.log('🧪 Debug: Simulating email event with:', email);
        if (this.app && this.app.performAutoSearch) {
          this.app.performAutoSearch(email);
          console.log('🧪 Simulated search triggered for:', email);
        } else {
          console.error('❌ App not available for simulation');
        }
      },
      debugMissiveAPI: () => {
        console.log('🧪 Debug: Comprehensive Missive API analysis...');
        console.log('🧪 window.Missive exists:', !!window.Missive);
        console.log('🧪 window.Missive type:', typeof window.Missive);
        console.log('🧪 Available methods:', Object.keys(window.Missive || {}));
        
        if (window.Missive) {
          console.log('🧪 getCurrentConversation:', typeof window.Missive.getCurrentConversation);
          console.log('🧪 fetchMessages:', typeof window.Missive.fetchMessages);
          console.log('🧪 on method:', typeof window.Missive.on);
          console.log('🧪 off method:', typeof window.Missive.off);
          
          // Try to call getCurrentConversation to see what happens
          if (typeof window.Missive.getCurrentConversation === 'function') {
            console.log('🧪 Testing getCurrentConversation...');
            window.Missive.getCurrentConversation()
              .then(conv => {
                console.log('🧪 getCurrentConversation result:', conv);
              })
              .catch(err => {
                console.log('🧪 getCurrentConversation error:', err);
              });
          }
        }
        
        return {
          exists: !!window.Missive,
          methods: Object.keys(window.Missive || {}),
          getCurrentConversation: typeof window.Missive?.getCurrentConversation,
          fetchMessages: typeof window.Missive?.fetchMessages
        };
      },
      checkVersionBadge: () => {
        console.log('🧪 Debug: Checking version badge status...');
        const el = document.querySelector('.version-badge');
        console.log('🧪 Version badge element:', el);
        console.log('🧪 Version badge text:', el?.textContent);
        console.log('🧪 Version badge classes:', el?.className);
        console.log('🧪 All version elements:', document.querySelectorAll('[class*="version"]'));
        console.log('🧪 All badge elements:', document.querySelectorAll('[class*="badge"]'));
        
        // Try to force set the version
        if (el) {
          el.textContent = 'vJS4.00';
          console.log('🧪 Forced version badge to vJS4.00');
        }
        
        return {
          element: el,
          text: el?.textContent,
          found: !!el
        };
      },
      testAllMissiveMethods: async () => {
        console.log('🧪 Debug: Testing all available Missive API methods...');
        const results = {};
        
        if (!window.Missive) {
          console.log('❌ window.Missive not available');
          return { error: 'window.Missive not available' };
        }
        
        const methods = [
          'getCurrentConversation',
          'fetchMessages', 
          'on',
          'off',
          'ready',
          'getConversation',
          'getConversations',
          'getCurrentUser',
          'getUsers',
          'getTeams',
          'getChannels'
        ];
        
        for (const method of methods) {
          try {
            console.log(`🧪 Testing ${method}...`);
            const methodExists = typeof window.Missive[method] === 'function';
            results[method] = { exists: methodExists, type: typeof window.Missive[method] };
            
            if (methodExists) {
              // Try to call the method (for methods that don't require parameters)
              if (['getCurrentConversation', 'getCurrentUser', 'getUsers', 'getTeams', 'getChannels'].includes(method)) {
                try {
                  const result = await window.Missive[method]();
                  results[method].result = result;
                  console.log(`✅ ${method} result:`, result);
                } catch (err) {
                  results[method].error = err.message;
                  console.log(`❌ ${method} error:`, err.message);
                }
              } else if (method === 'fetchConversations') {
                // Test fetchConversations with correct array parameter
                try {
                  const result = await window.Missive.fetchConversations(['test-id']);
                  results[method].result = result;
                  console.log(`✅ ${method} result:`, result);
                } catch (err) {
                  results[method].error = err.message;
                  console.log(`❌ ${method} error:`, err.message);
                }
              } else if (method === 'fetchMessages') {
                // Test fetchMessages with correct array parameter
                try {
                  const result = await window.Missive.fetchMessages(['test-conversation-id']);
                  results[method].result = result;
                  console.log(`✅ ${method} result:`, result);
                } catch (err) {
                  results[method].error = err.message;
                  console.log(`❌ ${method} error:`, err.message);
                }
              }
            }
          } catch (err) {
            results[method] = { exists: false, error: err.message };
          }
        }
        
        console.log('🧪 All method test results:', results);
        return results;
      },
      testEmailExtractionWithData: (testData) => {
        console.log('🧪 Debug: Testing email extraction with provided data...');
        console.log('🧪 Test data:', testData);
        
        if (this.app && this.app.extractEmailFromData) {
          const email = this.app.extractEmailFromData(testData);
          console.log('🧪 Extracted email:', email);
          
          // Also test the recursive search
          if (this.app.searchForEmailsRecursively) {
            const allEmails = this.app.searchForEmailsRecursively(testData, 'testData');
            console.log('🧪 All emails found recursively:', allEmails);
          }
          
          return { email, allEmails: this.app.searchForEmailsRecursively ? this.app.searchForEmailsRecursively(testData, 'testData') : [] };
        } else {
          console.error('❌ App not available for email extraction test');
          return { error: 'App not available' };
        }
      },
      captureMissiveData: async () => {
        console.log('🧪 Debug: Capturing ALL Missive data structures...');
        const results = {};
        
        if (!window.Missive) {
          console.log('❌ window.Missive not available');
          return { error: 'window.Missive not available' };
        }
        
        try {
          // Get current conversation
          if (window.Missive.getCurrentConversation) {
            console.log('📧 Getting current conversation...');
            results.currentConversation = await window.Missive.getCurrentConversation();
            console.log('📧 Current conversation structure:', JSON.stringify(results.currentConversation, null, 2));
          }
          
          // Get current user
          if (window.Missive.getCurrentUser) {
            console.log('👤 Getting current user...');
            results.currentUser = await window.Missive.getCurrentUser();
            console.log('👤 Current user structure:', JSON.stringify(results.currentUser, null, 2));
          }
          
          // Get users
          if (window.Missive.getUsers) {
            console.log('👥 Getting users...');
            results.users = await window.Missive.getUsers();
            console.log('👥 Users structure:', JSON.stringify(results.users, null, 2));
          }
          
          // Get teams
          if (window.Missive.getTeams) {
            console.log('🏢 Getting teams...');
            results.teams = await window.Missive.getTeams();
            console.log('🏢 Teams structure:', JSON.stringify(results.teams, null, 2));
          }
          
          // Get channels
          if (window.Missive.getChannels) {
            console.log('📺 Getting channels...');
            results.channels = await window.Missive.getChannels();
            console.log('📺 Channels structure:', JSON.stringify(results.channels, null, 2));
          }
          
          console.log('🧪 Complete Missive data capture:', results);
          return results;
          
        } catch (error) {
          console.error('❌ Error capturing Missive data:', error);
          return { error: error.message };
        }
      }
    };

    console.log('🧪 Debug methods available: window.MissWooDebug');
    
    // Ensure debug methods are available globally
    if (!window.MissWooDebug) {
      window.MissWooDebug = this.debugMethods;
    }
  }

  bindMissiveEvents() {
    if (this.isReady) return;
    this.isReady = true;

    console.log('🔧 Setting up Missive event listeners...');

    // Core lifecycle
    Missive.on('ready', async () => {
      console.log('✅ Missive ready event received');
      this.setBadge('vJS4.00');
      if (this.app?.setStatus) this.app.setStatus('Ready');
      // On ready, try to fetch current conversation/email once
      await this.tryPrimeEmail();
    });

    // Fallback: If ready event doesn't fire (as mentioned in documentation), try after a delay
    setTimeout(async () => {
      if (!this.isReady) {
        console.log('🔄 Missive ready event not received, trying fallback initialization...');
        this.setBadge('vJS4.00');
        if (this.app?.setStatus) this.app.setStatus('Ready (fallback)');
        await this.tryPrimeEmail();
      }
    }, 2000);

    Missive.on('error', (err) => {
      console.error('❌ Missive error event:', err);
      if (this.app?.setStatus) this.app.setStatus('Missive error', 'error');
    });

    // Enhanced event forwarding with better debugging
    const forward = async (eventType, data) => {
      console.log(`📧 Missive ${eventType} event received:`, data);
      console.log('📧 Data type:', typeof data);
      console.log('📧 Data keys:', data ? Object.keys(data) : 'null/undefined');
      console.log('📧 Current app state:', !!this.app);
      console.log('📧 Window.Missive available:', !!window.Missive);
      
      // Wait for app to be available if it's not ready yet
      if (!this.app) {
        console.log('⏳ App not available yet, waiting...');
        // Wait up to 5 seconds for app to be ready
        for (let i = 0; i < 50; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (this.app) {
            console.log('✅ App is now available');
            break;
          }
          if (i % 10 === 0) { // Log every second
            console.log(`⏳ Still waiting for app... (${i/10}s)`);
          }
        }
        if (!this.app) {
          console.log('❌ App still not available after waiting');
          console.log('❌ Trying to reinitialize app...');
          this.initializeApp();
          return;
        }
      }
      
      // Double-check that app methods are available
      if (!this.app.extractEmailFromData || !this.app.isValidEmailForSearch || !this.app.performAutoSearch) {
        console.log('❌ App methods not available:', {
          extractEmailFromData: !!this.app.extractEmailFromData,
          isValidEmailForSearch: !!this.app.isValidEmailForSearch,
          performAutoSearch: !!this.app.performAutoSearch
        });
        return;
      }
      
      // Handle conversation IDs array - fetch actual conversation data
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
        console.log('📧 Received conversation IDs array, fetching conversation data...');
        try {
          const conversationId = data[0];
          console.log('📧 Fetching conversation:', conversationId);
          
          // Debug: Check what Missive API methods are available
          console.log('🔍 Available Missive API methods:', Object.keys(window.Missive || {}));
          console.log('🔍 fetchConversations available:', !!(window.Missive && window.Missive.fetchConversations));
          console.log('🔍 getCurrentConversation available:', !!(window.Missive && window.Missive.getCurrentConversation));
          console.log('🔍 fetchMessages available:', !!(window.Missive && window.Missive.fetchMessages));
          
          // Use fetchConversations as the primary method (based on JavaScript API documentation)
          if (window.Missive && window.Missive.fetchConversations) {
            console.log('📧 Using fetchConversations (primary method)...');
            try {
              const conversations = await window.Missive.fetchConversations([conversationId]);
              console.log('📧 Fetched conversations via fetchConversations:', conversations);
              console.log('📧 Conversations structure:', JSON.stringify(conversations, null, 2));
              
              if (conversations && conversations.length > 0) {
                const conversation = conversations[0];
                console.log('📧 Using first conversation:', conversation);
                
                const email = this.app.extractEmailFromData(conversation);
                console.log('📧 Extracted email from conversation:', email);
                
                if (email && this.app.isValidEmailForSearch(email)) {
                  console.log('🔍 Triggering auto-search for:', email);
                  await this.app.performAutoSearch(email);
                  console.log('✅ Auto-search completed for:', email);
                } else {
                  console.log('❌ No valid email found in conversation data');
                  if (this.app?.setStatus) this.app.setStatus('No valid email found');
                }
              } else {
                console.log('❌ No conversations returned from fetchConversations');
                if (this.app?.setStatus) this.app.setStatus('No conversation data found');
              }
            } catch (fetchError) {
              console.error('❌ Error with fetchConversations:', fetchError);
              // Fallback to getCurrentConversation
              if (window.Missive && window.Missive.getCurrentConversation) {
                console.log('🔄 Trying getCurrentConversation as fallback...');
                try {
                  const conversation = await window.Missive.getCurrentConversation();
                  console.log('📧 Fetched conversation data via getCurrentConversation:', conversation);
                  
                  const email = this.app.extractEmailFromData(conversation);
                  console.log('📧 Extracted email from conversation:', email);
                  
                  if (email && this.app.isValidEmailForSearch(email)) {
                    console.log('🔍 Triggering auto-search for:', email);
                    await this.app.performAutoSearch(email);
                    console.log('✅ Auto-search completed for:', email);
                  } else {
                    console.log('❌ No valid email found in conversation data');
                    if (this.app?.setStatus) this.app.setStatus('No valid email found');
                  }
                } catch (apiError) {
                  console.error('❌ Error calling getCurrentConversation:', apiError);
                  if (this.app?.setStatus) this.app.setStatus('Error fetching conversation data', 'error');
                }
              } else {
                if (this.app?.setStatus) this.app.setStatus('Error fetching conversations', 'error');
              }
            }
          } else if (window.Missive && window.Missive.getCurrentConversation) {
            console.log('📧 Using getCurrentConversation (fallback method)...');
            try {
              const conversation = await window.Missive.getCurrentConversation();
              console.log('📧 Fetched conversation data:', conversation);
              
              const email = this.app.extractEmailFromData(conversation);
              console.log('📧 Extracted email from conversation:', email);
              
              if (email && this.app.isValidEmailForSearch(email)) {
                console.log('🔍 Triggering auto-search for:', email);
                await this.app.performAutoSearch(email);
                console.log('✅ Auto-search completed for:', email);
              } else {
                console.log('❌ No valid email found in conversation data');
                if (this.app?.setStatus) this.app.setStatus('No valid email found');
              }
            } catch (apiError) {
              console.error('❌ Error calling getCurrentConversation:', apiError);
              if (this.app?.setStatus) this.app.setStatus('Error fetching conversation data', 'error');
            }
          } else {
            console.log('❌ No conversation fetching methods available');
            console.log('❌ Available Missive methods:', Object.keys(window.Missive || {}));
            if (this.app?.setStatus) this.app.setStatus('Missive API methods not available', 'error');
          }
        } catch (error) {
          console.error('❌ Error fetching conversation data:', error);
          if (this.app?.setStatus) this.app.setStatus('Error fetching conversation', 'error');
        }
      } else {
        // Handle direct conversation data
        const email = this.app.extractEmailFromData(data);
        console.log('📧 Extracted email:', email);
        if (email && this.app.isValidEmailForSearch(email)) {
          console.log('🔍 Triggering auto-search for:', email);
          try {
            await this.app.performAutoSearch(email);
            console.log('✅ Auto-search completed for:', email);
          } catch (error) {
            console.error('❌ Auto-search failed:', error);
            if (this.app?.setStatus) this.app.setStatus('Auto-search failed', 'error');
          }
        } else {
          console.log('❌ Invalid email or not valid for search:', email);
          if (this.app?.setStatus) this.app.setStatus('No valid email found', 'error');
        }
      }
    };

    // Bind events with enhanced debugging
    const events = [
      'email:focus',
      'email:open', 
      'thread:focus',
      'conversation:focus',
      'conversation:open',
      'change:conversations'
    ];

    events.forEach(eventType => {
      console.log(`🔧 Binding ${eventType} event listener`);
      Missive.on(eventType, (data) => forward(eventType, data));
    });

    console.log('✅ All Missive event listeners bound');
  }

  async tryPrimeEmail() {
    try {
      console.log('🔍 Trying to prime email on Missive ready...');
      if (!this.app) {
        console.log('❌ App not available for priming');
        return;
      }

      // Prefer current conversation → participants → external email
      if (Missive.getCurrentConversation) {
        console.log('📧 Trying getCurrentConversation...');
        const conv = await Missive.getCurrentConversation();
        console.log('📧 Current conversation:', conv);
        const email = this.app.extractEmailFromData(conv);
        console.log('📧 Extracted email from conversation:', email);
        if (email && this.app.isValidEmailForSearch(email)) {
          console.log('🔍 Priming auto-search for:', email);
          await this.app.performAutoSearch(email);
          return;
        }
      }

      // Fallback: recent messages from focused conversation if available
      if (Missive.fetchMessages && Missive.getCurrentConversation) {
        console.log('📧 Trying fetchMessages fallback...');
        const conv = await Missive.getCurrentConversation();
        if (conv?.id) {
          const messages = await Missive.fetchMessages(conv.id, { limit: 10 });
          console.log('📧 Fetched messages:', messages);
          const email = this.app.extractEmailFromData({ messages });
          console.log('📧 Extracted email from messages:', email);
          if (email && this.app.isValidEmailForSearch(email)) {
            console.log('🔍 Priming auto-search for:', email);
            await this.app.performAutoSearch(email);
          }
        }
      }
      
      console.log('📧 No email found for priming');
    } catch (e) {
      console.error('❌ Error priming email:', e);
    }
  }
}

// Initialize bridge as soon as possible
try {
  new MissiveJSBridge();
} catch (e) {
  console.error('Failed to init MissiveJSBridge', e);
}


