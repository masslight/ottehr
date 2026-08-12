// vega-embed ships an `exports`-map package with no top-level `types`/`main`, invisible to the app's
// classic "node" moduleResolution. Point the bare specifier at the real build output — the physical
// files exist, so classic resolution finds them.
declare module 'vega-embed' {
  export * from 'vega-embed/build/embed';
  import embed from 'vega-embed/build/embed';
  export default embed;
}
