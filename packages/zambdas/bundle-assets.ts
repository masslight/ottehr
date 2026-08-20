/**
 * Works out which files from the `assets` tree each Zambda bundle actually needs.
 *
 * Every zip used to carry the whole tree, so most of each of the ~390 zips was
 * fonts and PDFs the Zambda never opens. Assets are read at runtime by path, so
 * esbuild's module graph knows nothing about them and the dependency has to be
 * recovered from the built output instead.
 *
 * Kept separate from bundle.ts so the selection rules can be unit tested — a
 * missing asset is a runtime failure in PDF generation, not a build error.
 */
import fs from 'fs';
import path from 'path';

// Two shapes mean the file name was not known at build time:
//   - a bare 'assets' literal, i.e. path.resolve(process.cwd(), 'assets', name)
//   - a literal ending at the separator, i.e. './assets/' + name
// In both, the name may only exist at runtime — getHTMLStatementTemplate takes
// it from a request parameter. A complete './assets/logo.png' deliberately does
// not match either shape: there the name is right in the literal and survives
// minification.
const SEGMENT_BUILT_ASSET_PATH = /['"`]assets['"`]|['"`][^'"`]*assets\/['"`]/;

const LICENSE_FILE = /^(ofl|license|copying)/i;

/** Paths of every file under `dir`, relative to it, sorted so zips stay reproducible. */
export const listAssetFiles = (dir: string, prefix = ''): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listAssetFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    )
    .sort();
};

/**
 * The assets `bundleSource` can reach, as paths relative to the assets root.
 *
 * Both reference styles in the codebase leave the file name as a literal that
 * survives minification, so a bundle needs an asset when the asset's file name
 * appears in it. When a bundle assembles asset paths from segments we cannot
 * resolve, this returns the whole tree rather than guess: over-including is
 * merely wasteful, while under-including breaks the Zambda at runtime.
 */
export const assetsRequiredBy = (bundleSource: string, assetFiles: string[]): string[] => {
  if (SEGMENT_BUILT_ASSET_PATH.test(bundleSource)) return [...assetFiles].sort();

  const required = new Set(assetFiles.filter((file) => bundleSource.includes(path.basename(file))));

  // Fonts ship with their licence; keep it beside any font we include.
  const requiredDirs = new Set([...required].map((file) => path.dirname(file)));
  for (const file of assetFiles) {
    if (requiredDirs.has(path.dirname(file)) && LICENSE_FILE.test(path.basename(file))) required.add(file);
  }

  return [...required].sort();
};
