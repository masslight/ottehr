import * as esbuild from 'esbuild';
// ESM variant: keeps utils on the same module instances as the vite-processed graph,
// which should heal the zod/@oystehr-sdk instanceof + interop splits seen with CJS.
const WORKSPACE_DEPS = new Set(['config-types']);
const r = await esbuild.build({
  entryPoints: ['lib/main.ts'],
  bundle: true, format: 'esm', platform: 'node', target: 'node22',
  outfile: 'dist/main.mjs', logLevel: 'error', metafile: true,
  plugins: [{ name: 'ext', setup(b) {
    b.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.[^/]/ }, (a) => {
      const pkg = a.path.startsWith('@') ? a.path.split('/').slice(0,2).join('/') : a.path.split('/')[0];
      return WORKSPACE_DEPS.has(pkg) ? null : { path: a.path, external: true };
    });
  }}],
});
console.log('bytes:', Object.values(r.metafile.outputs)[0].bytes);
