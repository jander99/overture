/**
 * Jest mock for chalk library
 * Provides chainable color/style methods that return plain text
 */

const createChainableMock = () => {
  // Base function that returns the input string unchanged
  const mockFn = (str: string) => str;

  // Color and style methods that all return the input unchanged
  const colorMethods = {
    bold: (str: string) => str,
    blue: (str: string) => str,
    yellow: (str: string) => str,
    magenta: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    dim: (str: string) => str,
    bgBlue: (str: string) => str,
    bgGreen: (str: string) => str,
    bgRed: (str: string) => str,
  };

  // Create chainable versions: each method returns an object with all methods
  const chainable = Object.assign(mockFn, {
    bold: Object.assign((str: string) => str, colorMethods),
    blue: Object.assign((str: string) => str, colorMethods),
    yellow: Object.assign((str: string) => str, colorMethods),
    magenta: Object.assign((str: string) => str, colorMethods),
    green: Object.assign((str: string) => str, colorMethods),
    red: Object.assign((str: string) => str, colorMethods),
    gray: Object.assign((str: string) => str, colorMethods),
    cyan: Object.assign((str: string) => str, colorMethods),
    dim: Object.assign((str: string) => str, colorMethods),
    bgBlue: Object.assign((str: string) => str, colorMethods),
    bgGreen: Object.assign((str: string) => str, colorMethods),
    bgRed: Object.assign((str: string) => str, colorMethods),
  });

  return chainable;
};

export default createChainableMock();
