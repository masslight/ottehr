// Builds the studio's sandboxed report runtime (React + the EHR's Report components + ECharts +
// Vega-Lite + the JSX transpiler + the data-map helpers) with esbuild and exposes it as a virtual
// module, the same way apps/ehr/adhoc-report-runtime-plugin.ts does for the EHR's own runtime:
//
//   import runtimeBundle from 'virtual:report-studio-runtime'; // → the bundle source as a string
//
// The EHR plugin hardcodes its own entry file, so this is a copy with a different entry rather than
// a shared helper; the two should be merged when the studio runtime moves into the EHR.
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { build } from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Plugin } from 'vite';

const BUILD_TARGET = browserslistToEsbuild();
const VIRTUAL_ID = 'virtual:report-studio-runtime';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.join(appRoot, 'runtime');

export function reportStudioRuntime(): Plugin {
  let cached: Promise<string> | null = null;
  let bundledFiles = new Set<string>();

  const bundleRuntime = (): Promise<string> =>
    (cached ??= build({
      entryPoints: [path.join(RUNTIME_DIR, 'index.tsx')],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: BUILD_TARGET,
      minify: true,
      legalComments: 'none',
      metafile: true,
      preserveSymlinks: true,
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    }).then((result) => {
      bundledFiles = new Set(Object.keys(result.metafile.inputs).map((file) => path.resolve(appRoot, file)));
      return result.outputFiles[0].text;
    }));

  return {
    name: 'report-studio-runtime',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      return `export default ${JSON.stringify(await bundleRuntime())};`;
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.startsWith(RUNTIME_DIR) && !bundledFiles.has(ctx.file)) return undefined;
      cached = null;
      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) ctx.server.moduleGraph.invalidateModule(mod);
      ctx.server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
