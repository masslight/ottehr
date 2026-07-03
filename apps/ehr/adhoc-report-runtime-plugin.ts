// Builds the self-contained iframe runtime bundle (React + MUI/DataGridPro + ECharts + Vega-Lite +
// the Report components) and exposes it to the app as a virtual module:
//
//   import runtimeBundle from 'virtual:adhoc-report-runtime'; // → the bundle source as a string
import { build } from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:adhoc-report-runtime';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.join(appRoot, 'src', 'features', 'report-builder', 'runtime');

export function adHocReportRuntime(): Plugin {
  let cached: Promise<string> | null = null;
  // Every source file the last bundle was built from (absolute paths). The runtime pulls in shared
  // code from packages/utils too, so watching RUNTIME_DIR alone would serve a stale frame after an
  // edit there — the whole reason a dev-server restart used to be needed.
  let bundledFiles = new Set<string>();

  const bundleRuntime = (): Promise<string> =>
    (cached ??= build({
      entryPoints: [path.join(RUNTIME_DIR, 'index.tsx')],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2019',
      minify: true,
      legalComments: 'none',
      metafile: true,
      // MUI & friends branch on NODE_ENV; the frame always gets the production build.
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    }).then((result) => {
      bundledFiles = new Set(Object.keys(result.metafile.inputs).map((file) => path.resolve(appRoot, file)));
      return result.outputFiles[0].text;
    }));

  return {
    name: 'adhoc-report-runtime',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      return `export default ${JSON.stringify(await bundleRuntime())};`;
    },
    // Rebuild when ANY file the bundle was built from changes (frame sources and the shared
    // packages they import), so the next frame mount gets fresh code without a server restart.
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
