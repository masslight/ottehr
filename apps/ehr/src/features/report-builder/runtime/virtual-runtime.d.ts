// The iframe runtime bundle, compiled by the adhoc-report-runtime vite plugin (see
// apps/ehr/adhoc-report-runtime-plugin.ts) and delivered as a source string. Imported dynamically by
// useSandbox so it lands in its own lazily-loaded chunk.
declare module 'virtual:adhoc-report-runtime' {
  const bundle: string;
  export default bundle;
}
