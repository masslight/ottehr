/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

// vite 8 ships an `exports`-map package with no top-level `types`/`main`, invisible to the app's
// classic "node" moduleResolution. Point the bare specifier at the real build output — the physical
// files exist, so classic resolution finds them.
declare module 'vite' {
  export * from 'vite/dist/node/index';
}
