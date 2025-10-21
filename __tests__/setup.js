// Mock browser environment
global.window = {
  Missive: {
    on: jest.fn()
  }
};

global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  querySelector: jest.fn(),
  body: {
    innerHTML: ''
  }
};

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([])
  })
);