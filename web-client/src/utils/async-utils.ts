/**
 * Checks if a value is a Promise.
 * @param value - The value to check if it is a Promise.
 * @typeParam T - The type of the value that may be a Promise.
 * @description This function checks if the provided value is a Promise. It returns true if the value is an instance of Promise or if it has a `then` method, indicating that it behaves like a Promise.
 * @returns A boolean indicating whether the value is a Promise.
 */
export function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return value instanceof Promise || (typeof value === 'object' && value !== null && 'then' in value);
}

/**
 * Creates a new Promise which resolves by queueing a microtask.
 * A microtask is a short function which runs after the function or event that created it exits and only if JavaScript
 * is not currently executing anything else. Use this function when you want to asynchronously execute code
 * but want it to run as soon as possible, without a delay duration.
 *
 * @returns A Promise object that represents a microtask.
 *
 * @example
 * microtask().then(() => {
 *   console.log("This will run as soon as possible, asynchronously.");
 * });
 */
export const microtask = () => new Promise<void>(queueMicrotask);

/**
 * Creates a promise that resolves after the current event loop has been processed
 * (i.e., after all microtasks have been completed). This can be thought of as making
 * an asynchronous task that executes after the current `macrotask`.
 *
 * @returns A new Promise that resolves after the current event loop.
 *
 * @example
 *
 * macrotask().then(() => {
 *   // This function will execute after all the current microtasks
 *   console.log('This is a macrotask');
 * });
 *
 */
export const macrotask = () => new Promise<void>(r => setTimeout(r));

/**
 * Creates a new Promise that is resolved using `requestAnimationFrame`.
 *
 * This function can be used for delaying execution of code until the next frame,
 * which is useful in animation-related operations.
 *
 * @returns A new Promise that is resolved with `requestAnimationFrame`.
 *
 * @example
 *
 * async function animate() {
 *   // ...some animation logic...
 *
 *   // Wait for the next frame
 *   await animationFrame();
 *
 *   // ...more animation logic...
 * }
 */
export const animationFrame = () =>
  new Promise<void>(r => requestAnimationFrame(() => { r(); }));

/**
 * Creates a Promise that resolves after a specified duration.
 *
 * @param ms - The amount of time (in milliseconds) to wait before the Promise resolves.
 * @returns A Promise that resolves after the specified duration.
 *
 * @example
 * //Wait for 1 second (1000 ms)
 * await timeout(1000);
 */
export const timeout = <T>(ms: number) => new Promise<T>(r => setTimeout(r, ms));
