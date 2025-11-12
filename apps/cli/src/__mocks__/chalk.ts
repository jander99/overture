/**
 * Jest mock for chalk library
 * Provides recursive chainable color/style methods that return plain text
 * Supports unlimited chaining (e.g., chalk.bold.cyan.dim.green('text'))
 */

const createChainableMock = (): any => {
  // Base function that returns the input string unchanged
  const mockFn = (str: string) => str;

  // All chalk methods that should support chaining
  const methods = [
    'bold',
    'blue',
    'yellow',
    'magenta',
    'green',
    'red',
    'gray',
    'cyan',
    'dim',
    'bgBlue',
    'bgGreen',
    'bgRed',
  ];

  // Add each method as a property getter that returns another chainable mock
  // This enables recursive chaining to any depth
  methods.forEach((method) => {
    Object.defineProperty(mockFn, method, {
      get: () => createChainableMock(),
      enumerable: true,
      configurable: true,
    });
  });

  return mockFn;
};

export default createChainableMock();
