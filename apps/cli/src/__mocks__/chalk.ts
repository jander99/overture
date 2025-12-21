/**
 * Vitest mock for chalk library
 * Simple passthrough mock that supports chaining
 * All color/style methods return the input string unchanged
 */

// Create a simple passthrough function
const passThroughFn = (str?: string | number) => String(str || '');

// Color and style methods
const methods = [
  'reset',
  'bold',
  'dim',
  'italic',
  'underline',
  'inverse',
  'hidden',
  'strikethrough',
  'visible',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'grey',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
  'bgBlack',
  'bgRed',
  'bgGreen',
  'bgYellow',
  'bgBlue',
  'bgMagenta',
  'bgCyan',
  'bgWhite',
  'bgGray',
  'bgGrey',
  'bgBlackBright',
  'bgRedBright',
  'bgGreenBright',
  'bgYellowBright',
  'bgBlueBright',
  'bgMagentaBright',
  'bgCyanBright',
  'bgWhiteBright',
];

// Create the main chalk function
const chalk: any = (str?: string | number) => String(str || '');

// Add all methods to chalk, where each method is a function that can also be chained
methods.forEach((method) => {
  // Create a function for this method
  const methodFn: any = (str?: string | number) => String(str || '');

  // Add all methods to this function too (for chaining like chalk.blue.bold())
  methods.forEach((m) => {
    methodFn[m] = passThroughFn;
  });

  // Assign to chalk
  chalk[method] = methodFn;
});

export default chalk;
