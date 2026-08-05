import * as esbuild from 'esbuild';

// Bundle utils' own source AND its workspace deps (config-types) — those are TS and Node
// can't load them. Leave real node_modules deps external so Node loads them once per worker.
const WORKSPACE_DEPS = new Set(['config-types']);

const r = await esbuild.build({
  entryPoints: ['lib/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  outfile: 'dist/main.cjs',
  logLevel: 'error',
  metafile: true,
  plugins: [
    {
      name: 'external-node-modules-only',
      setup(build) {
        build.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.[^/]/ }, (args) => {
          const pkg = args.path.startsWith('@') ? args.path.split('/').slice(0, 2).join('/') : args.path.split('/')[0];
          if (WORKSPACE_DEPS.has(pkg)) return null; // bundle workspace TS in
          return { path: args.path, external: true };
        });
      },
    },
  ],
});
const out = Object.values(r.metafile.outputs)[0];
console.log('bytes:', out.bytes, 'inputs bundled:', Object.keys(out.inputs).length);
