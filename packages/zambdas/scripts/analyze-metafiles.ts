import fs from 'fs';
import path from 'path';

interface Metafile {
  inputs: Record<string, { bytes: number; imports: { path: string; kind: string }[]; format?: string }>;
  outputs: Record<
    string,
    {
      bytes: number;
      entryPoint?: string;
      inputs: Record<string, { bytesInOutput: number }>;
    }
  >;
}

const metaDir = path.resolve(__dirname, '../.dist/meta');
const chunks: Metafile[] = fs
  .readdirSync(metaDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(metaDir, f), 'utf-8')) as Metafile);

interface BundleStats {
  zambda: string;
  outBytes: number;
  topInputs: { path: string; bytes: number; pct: number }[];
}

const allBundles: BundleStats[] = [];

for (const meta of chunks) {
  for (const [outPath, out] of Object.entries(meta.outputs)) {
    if (!out.entryPoint || !outPath.endsWith('.js')) continue;
    const zambda = out.entryPoint.replace(/^src\//, '').replace(/\.ts$/, '');
    const inputs = Object.entries(out.inputs)
      .map(([p, info]) => ({ path: p, bytes: info.bytesInOutput }))
      .sort((a, b) => b.bytes - a.bytes);
    const top = inputs.slice(0, 8).map((i) => ({
      path: i.path,
      bytes: i.bytes,
      pct: (i.bytes / out.bytes) * 100,
    }));
    allBundles.push({ zambda, outBytes: out.bytes, topInputs: top });
  }
}

allBundles.sort((a, b) => b.outBytes - a.outBytes);

const fmt = (n: number): string =>
  n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' kB';

console.log('=== TOTAL BUNDLES:', allBundles.length, '===\n');

console.log('=== LARGEST 10 BUNDLES ===');
for (const b of allBundles.slice(0, 10)) {
  console.log(`\n${b.zambda} — ${fmt(b.outBytes)}`);
  for (const i of b.topInputs) {
    console.log(`  ${i.pct.toFixed(1).padStart(5)}%  ${fmt(i.bytes).padStart(10)}  ${i.path}`);
  }
}

console.log('\n=== SMALLEST 5 BUNDLES (best case) ===');
for (const b of allBundles.slice(-5)) {
  console.log(`\n${b.zambda} — ${fmt(b.outBytes)}`);
  for (const i of b.topInputs.slice(0, 5)) {
    console.log(`  ${i.pct.toFixed(1).padStart(5)}%  ${fmt(i.bytes).padStart(10)}  ${i.path}`);
  }
}

// Aggregate: how often does each "heavy" path appear in bundles?
const moduleAppearance = new Map<string, { count: number; totalBytes: number }>();

const interesting = (p: string): string | null => {
  // Normalize npm deps
  const npm = p.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  if (npm) return `npm:${npm[1]}`;
  // shared submodules (path is relative from packages/zambdas)
  const shared = p.match(/^src\/shared\/([^/.]+)/);
  if (shared) return `shared/${shared[1]}`;
  // utils submodules (path is relative from packages/zambdas: ../utils/lib/...)
  const utils = p.match(/\.\.\/utils\/lib\/([^/.]+)/);
  if (utils) return `utils/${utils[1]}`;
  return null;
};

// Re-aggregate with full input data
for (const meta of chunks) {
  for (const [outPath, out] of Object.entries(meta.outputs)) {
    if (!out.entryPoint || !outPath.endsWith('.js')) continue;
    const seen = new Set<string>();
    for (const [p, info] of Object.entries(out.inputs)) {
      const key = interesting(p);
      if (!key) continue;
      if (seen.has(key)) {
        const cur = moduleAppearance.get(key)!;
        cur.totalBytes += info.bytesInOutput;
        continue;
      }
      seen.add(key);
      const cur = moduleAppearance.get(key) ?? { count: 0, totalBytes: 0 };
      cur.count += 1;
      cur.totalBytes += info.bytesInOutput;
      moduleAppearance.set(key, cur);
    }
  }
}

const totalBundles = allBundles.length;
const aggregated = [...moduleAppearance.entries()]
  .map(([key, v]) => ({
    key,
    bundles: v.count,
    pctOfBundles: (v.count / totalBundles) * 100,
    totalBytes: v.totalBytes,
    avgBytes: v.totalBytes / v.count,
  }))
  .sort((a, b) => b.totalBytes - a.totalBytes);

console.log('\n\n=== TOP MODULES BY TOTAL BYTES ACROSS ALL BUNDLES ===');
console.log('(count = # of bundles containing it; totalBytes = sum across all bundles)\n');
console.log('count   pctBundles   totalBytes    avgPerBundle   module');
for (const m of aggregated.slice(0, 40)) {
  console.log(
    `${String(m.bundles).padStart(4)}   ${m.pctOfBundles.toFixed(1).padStart(5)}%      ${fmt(m.totalBytes).padStart(
      10
    )}    ${fmt(m.avgBytes).padStart(10)}     ${m.key}`
  );
}

console.log('\n\n=== shared/* SUBMODULES — appearance frequency ===');
const sharedRows = aggregated.filter((m) => m.key.startsWith('shared/'));
for (const m of sharedRows) {
  console.log(
    `${String(m.bundles).padStart(4)}/${totalBundles} (${m.pctOfBundles.toFixed(1).padStart(4)}%)  avg ${fmt(
      m.avgBytes
    ).padStart(8)}   ${m.key}`
  );
}

console.log('\n=== utils/* SUBMODULES — appearance frequency ===');
const utilsRows = aggregated.filter((m) => m.key.startsWith('utils/'));
for (const m of utilsRows) {
  console.log(
    `${String(m.bundles).padStart(4)}/${totalBundles} (${m.pctOfBundles.toFixed(1).padStart(4)}%)  avg ${fmt(
      m.avgBytes
    ).padStart(8)}   ${m.key}`
  );
}

console.log('\n=== npm DEPENDENCIES — appearance frequency ===');
const npmRows = aggregated.filter((m) => m.key.startsWith('npm:'));
for (const m of npmRows) {
  console.log(
    `${String(m.bundles).padStart(4)}/${totalBundles} (${m.pctOfBundles.toFixed(1).padStart(4)}%)  avg ${fmt(
      m.avgBytes
    ).padStart(8)}   ${m.key}`
  );
}
