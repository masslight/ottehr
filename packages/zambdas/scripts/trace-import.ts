import fs from 'fs';
import path from 'path';

interface Metafile {
  inputs: Record<string, { bytes: number; imports: { path: string; kind: string; original?: string }[] }>;
  outputs: Record<string, { entryPoint?: string; inputs: Record<string, { bytesInOutput: number }> }>;
}

const target = process.argv[2];
if (!target) {
  console.error('Usage: tsx trace-import.ts <substring>');
  process.exit(1);
}

const metaDir = path.resolve(__dirname, '../.dist/meta');
const chunks: Metafile[] = fs
  .readdirSync(metaDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(metaDir, f), 'utf-8')) as Metafile);

// Build reverse import graph: target -> [importers]
for (const meta of chunks) {
  const reverse = new Map<string, Set<string>>();
  for (const [importer, info] of Object.entries(meta.inputs)) {
    for (const imp of info.imports) {
      if (!reverse.has(imp.path)) reverse.set(imp.path, new Set());
      reverse.get(imp.path)!.add(importer);
    }
  }

  // Find any input matching target
  const matches = Object.keys(meta.inputs).filter((p) => p.includes(target));
  if (matches.length === 0) continue;
  console.log(`\n=== Chunk has ${matches.length} matching inputs ===`);
  for (const m of matches.slice(0, 3)) {
    console.log(`\nTarget: ${m}`);
    // BFS backwards 3 levels
    const visited = new Set<string>([m]);
    let frontier = [m];
    for (let depth = 1; depth <= 4; depth++) {
      const next: string[] = [];
      for (const node of frontier) {
        const importers = reverse.get(node);
        if (!importers) continue;
        for (const imp of importers) {
          if (visited.has(imp)) continue;
          visited.add(imp);
          // Only print non-node_modules importers, or first-level npm package boundaries
          if (!imp.includes('node_modules') || depth <= 2) {
            console.log(`  ${'  '.repeat(depth)}<- ${imp}`);
          }
          next.push(imp);
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
  }
  break; // one chunk is enough
}
