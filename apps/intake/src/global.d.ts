declare module 'object.hasown' {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  export const shim = (): void => {};
}

declare global {
  interface Window {
    global: any;
  }
}
