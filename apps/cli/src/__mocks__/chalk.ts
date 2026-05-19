/**
 * Vitest mock for chalk library
 * Simple passthrough mock that supports chaining
 * All color/style methods return the input string unchanged
 */

type ChalkMock = ((str?: string | number) => string) &
  Record<string, (str?: string | number) => string>;

// Create a simple passthrough function
const passThroughFn = (str?: string | number) => String(str ?? '');

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

const createChainableMethod = (): ChalkMock => {
  const methodFn = ((str?: string | number) => String(str ?? '')) as ChalkMock;

  // Add all methods to this function too (for chaining like chalk.blue.bold())
  methods.forEach((m) => {
    // eslint-disable-next-line security/detect-object-injection -- methods are static chalk style names defined above
    methodFn[m] = passThroughFn;
  });

  return methodFn;
};

// Create the main chalk function
const chalk = ((str?: string | number) => String(str ?? '')) as ChalkMock;

// Add all methods to chalk, where each method is a function that can also be chained
methods.forEach((method) => {
  // eslint-disable-next-line security/detect-object-injection -- methods are static chalk style names defined above
  chalk[method] = createChainableMethod();
});

export default chalk;
