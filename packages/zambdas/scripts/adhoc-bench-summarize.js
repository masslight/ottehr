// node scripts/adhoc-bench-summarize.js <dir> "<ranges>" "<reports>" <passes> "<ways>"
const fs = require('fs');
const [dir, rangesS, reportsS, passesS, waysS] = process.argv.slice(2);
const ranges = rangesS.split(' ');
const reports = reportsS.split(' ');
const passes = Number(passesS || 1);
const ways = (waysS || 'ideal valerii-layers otr3737-runner').split(' ').filter(Boolean);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { error: 'no result' }; } };
const s = (ms) => (ms === undefined ? '-' : (ms / 1000).toFixed(1));
const norm = (r) => JSON.stringify(r, (k, v) => (k === 'avgF' && typeof v === 'number' ? Math.round(v * 5) / 5 : v));
const diff = (a, b) => {
  if (!a || !b) return 'no result to compare';
  if (norm(a) === norm(b)) return 'same';
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const bad = keys.filter((k) => norm(a[k]) !== norm(b[k]));
  return `DIFFERENT in ${bad.length} of ${keys.length}: ` +
    bad.slice(0, 4).map((k) => `${k} ideal=${JSON.stringify(b[k])} got=${JSON.stringify(a[k])}`).join('; ');
};
const totals = (report, r) => {
  if (!r || r.error || r.skipped || !r.result) return '';
  const res = r.result;
  if (report === 'r1') return `visits=${Object.values(res).reduce((a, b) => a + b, 0)}`;
  if (report === 'r2') {
    const v = Object.values(res);
    return `visits=${v.reduce((a, b) => a + b.visits, 0)} withTemp=${v.reduce((a, b) => a + b.withTemperature, 0)}`;
  }
  if (report === 'r3') return `visits=${res.visits} withDx=${res.withDiagnosis} withCpt=${res.withCpt}`;
  if (report === 'r4') {
    const v = Object.values(res);
    return `visits=${v.reduce((a, b) => a + b.visits, 0)} withTemp=${v.reduce((a, b) => a + b.withTemperature, 0)} withDx=${v.reduce((a, b) => a + b.withDiagnosis, 0)} allergic=${v.reduce((a, b) => a + b.withAllergicPatient, 0)}`;
  }
  const v = Object.entries(res).filter(([k]) => k.startsWith('location ')).map(([, x]) => x);
  return `visits=${v.reduce((a, b) => a + b.visits, 0)} new=${v.reduce((a, b) => a + b.newPatientVisits, 0)} withCpt=${v.reduce((a, b) => a + b.withCpt, 0)}`;
};

for (const days of ranges) {
  console.log(`\n================ ${days} days`);
  const counts = read(`${dir}/counts-${days}d.json`);
  console.log(`exact counts: ${JSON.stringify(counts)}`);
  for (let p = 1; p <= passes; p++) {
    for (const report of reports) {
      const res = Object.fromEntries(ways.map((w) => [w, read(`${dir}/p${p}-${report}-${days}d-${w}.json`)]));
      console.log(`\n### pass ${p}  ${report}, ${days} days`);
      const ideal = res.ideal;
      for (const w of ways) {
        const r = res[w];
        const ratio = ideal && !ideal.error && r.ms && !r.skipped ? `${(r.ms / ideal.ms).toFixed(2)}x` : '-';
        const vs = w === 'ideal' ? 'reference' : r.skipped ? 'SKIPPED' : r.error || !ideal || ideal.error ? '-' : diff(r.result, ideal.result);
        console.log(`  ${w.padEnd(16)} ${String(r.skipped ? '-' : s(r.ms)).padStart(7)} s  ${ratio.padStart(6)}  req ${String(r.requests ?? '-').padStart(4)}  ` +
          `${r.error ? `ERROR ${r.error}` : r.skipped ? `skipped: ${r.skipped}` : `result: ${vs}`}  [${totals(report, r)}]` +
          `${r.networkRetries ? `  (network retries ${r.networkRetries})` : ''}`);
      }
      for (const w of ways) {
        const groups = res[w].groups ?? [];
        if (!groups.length) continue;
        console.log(`    ${w} — where the time went:`);
        for (const g of groups) {
          const extra = [g.requests !== undefined ? `${g.requests} req` : '', g.resources !== undefined ? `${g.resources} res` : ''].filter(Boolean).join(', ');
          console.log(`      ${g.name.padEnd(36)} ${s(g.ms).padStart(7)} s${extra ? `  (${extra})` : ''}`);
        }
      }
    }
  }
}

console.log('\n================ notable log lines (FAILED / cap / split / timeout / errors), all runs incl. warm-up');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.log')).sort()) {
  const lines = fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n');
  const hits = lines.filter((l) =>
    /FAILED|TIMEOUT|still fails|cannot be split|the most one bulk job|30 000|error file|answered|Error:/i.test(l) ||
    /resources=(\d+)/.test(l) && Number(/resources=(\d+)/.exec(l)[1]) >= 30000 && / job=/.test(l)
  );
  if (hits.length) {
    console.log(`-- ${f}`);
    for (const h of hits.slice(0, 12)) console.log(`   ${h.slice(0, 400)}`);
    if (hits.length > 12) console.log(`   ... ${hits.length - 12} more`);
  }
}
console.log(`\nraw: ${dir}`);
