import { resolve } from 'path';

// Archetype fixture image paths (scenario.patient.fixtures.*: ID cards, insurance
// cards) are stored RELATIVE to the example file (e.g. "../fixtures/foo.jpeg").
// census/population materialize a per-visit scenario into a temp dir at a DIFFERENT
// depth than examples/ (population's .scenarios/ is one level deeper), so the
// relative path resolves to a nonexistent location — and the harness's uploadFixture
// then silently logs "fixture not found" and skips the ID/insurance-card uploads.
// Rewrite the paths to absolute (against the examples dir) at materialization time so
// they resolve wherever the temp scenario file is written. path.resolve in the
// harness leaves an already-absolute path untouched, so this is safe.
export function absolutizeFixtures(scenario: any, examplesDir: string): void {
  const fx = scenario?.patient?.fixtures;
  if (!fx || typeof fx !== 'object') return;
  for (const key of Object.keys(fx)) {
    if (typeof fx[key] === 'string' && fx[key]) fx[key] = resolve(examplesDir, fx[key]);
  }
}
