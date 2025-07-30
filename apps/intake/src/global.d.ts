declare module 'object.hasown' {
  export const shim = (): void => {};
}

declare global {
  interface Window {
    global: any;
  }
}
