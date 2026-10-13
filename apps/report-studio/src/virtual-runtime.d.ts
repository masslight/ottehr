declare module 'virtual:report-studio-runtime' {
  /** The sandboxed report runtime bundle (IIFE), built by runtime-plugin.ts. */
  const bundle: string;
  export default bundle;
}

declare const __BUILD_TIME__: string;
