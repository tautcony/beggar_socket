/**
 * A error thrown when a method is defined but not implemented (yet).
 */
export default class NotImplementedError extends Error {
  constructor(message?: string) {
    const sender = (new Error())
      .stack
      ?.split('\n')[2]
      ?.replace(' at ', '') || 'unknown method';

    let errorMessage = `The method ${sender} isn't implemented.`;

    // Append the message if given.
    if (message) {
      errorMessage += ` Message: "${message}".`;
    }

    // Clean up multiple spaces
    while (errorMessage.indexOf('  ') > -1) {
      errorMessage = errorMessage.replace('  ', ' ');
    }

    super(errorMessage);
    this.name = 'NotImplementedError';
  }
}
