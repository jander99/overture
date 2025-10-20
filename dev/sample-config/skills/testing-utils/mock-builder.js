/**
 * Mock builder utility for generating test mocks
 */

class MockBuilder {
  constructor() {
    this.mocks = new Map();
  }

  /**
   * Create a mock for a given interface/class
   */
  createMock(name, methods = []) {
    const mock = {};

    methods.forEach(method => {
      mock[method] = jest.fn();
    });

    this.mocks.set(name, mock);
    return mock;
  }

  /**
   * Create a mock with specific return values
   */
  createMockWithReturns(name, methodReturns = {}) {
    const mock = {};

    Object.keys(methodReturns).forEach(method => {
      mock[method] = jest.fn().mockReturnValue(methodReturns[method]);
    });

    this.mocks.set(name, mock);
    return mock;
  }

  /**
   * Create a mock with async methods
   */
  createAsyncMock(name, methods = []) {
    const mock = {};

    methods.forEach(method => {
      mock[method] = jest.fn().mockResolvedValue(undefined);
    });

    this.mocks.set(name, mock);
    return mock;
  }

  /**
   * Reset all mocks
   */
  resetAll() {
    this.mocks.forEach(mock => {
      Object.keys(mock).forEach(method => {
        if (typeof mock[method].mockReset === 'function') {
          mock[method].mockReset();
        }
      });
    });
  }

  /**
   * Get a previously created mock
   */
  getMock(name) {
    return this.mocks.get(name);
  }

  /**
   * Generate mock data for common types
   */
  generateMockData(type) {
    const generators = {
      user: () => ({
        id: Math.floor(Math.random() * 1000),
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString()
      }),
      post: () => ({
        id: Math.floor(Math.random() * 1000),
        title: 'Test Post',
        content: 'This is test content',
        authorId: Math.floor(Math.random() * 100),
        createdAt: new Date().toISOString()
      }),
      apiResponse: (data = {}) => ({
        status: 200,
        data,
        message: 'Success'
      }),
      error: (message = 'Test error') => ({
        status: 500,
        message,
        timestamp: new Date().toISOString()
      })
    };

    return generators[type] ? generators[type]() : null;
  }
}

module.exports = MockBuilder;

// Example usage:
// const builder = new MockBuilder();
// const userService = builder.createMock('UserService', ['getUser', 'createUser']);
// userService.getUser.mockReturnValue({ id: 1, name: 'Test' });
