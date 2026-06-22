/**
 * verify-inhouse-lab-dispatch.ts — exercise the exact two zambda calls the easy-chart
 * `add-in-house-lab` dispatch handler makes (get-create-in-house-lab-order-resources →
 * create-in-house-lab-order), using the same name-token matching, to confirm an in-house lab
 * order (ServiceRequest) is created.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/easy-chart-eval/verify-inhouse-lab-dispatch.ts <encounterId> "<search term>" [--execute]
 */

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function getToken(): Promise<string> {
  const res = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function zap(name: string, token: string, body: unknown): Promise<any> {
  const res = await fetch(`http://localhost:3000/local/zambda/${name}/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${name} -> ${res.status}: ${text.slice(0, 500)}`);
  return json.output ?? json;
}

// Mirror of findLabCatalogMatches in EasyChartPage.tsx (token-overlap scoring).
const STOP = new Set([
  'order',
  'send',
  'run',
  'a',
  'an',
  'the',
  'out',
  'in',
  'house',
  'office',
  'lab',
  'labs',
  'test',
  'tests',
  'do',
  'get',
  'please',
  'to',
  'and',
  'for',
  'reference',
  'panel',
]);
const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
function match<T>(display: string, terms: string[], items: T[], getName: (i: T) => string): T[] {
  const q = Array.from(new Set([display, ...terms].flatMap(tokenize).filter((t) => t.length >= 2 && !STOP.has(t))));
  if (!q.length) return [];
  const ql = display.trim().toLowerCase();
  return items
    .map((item) => {
      const nt = tokenize(getName(item));
      const nl = getName(item).trim().toLowerCase();
      let score = 0;
      for (const t of q) {
        if (nt.includes(t)) score += 20;
        else if (nt.some((x) => x.startsWith(t))) score += 5;
      }
      if (nl === ql) score += 1000;
      score -= Math.max(0, nt.length - q.length) * 2;
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}

async function main(): Promise<void> {
  const [encounterId, term] = process.argv.slice(2);
  const execute = process.argv.includes('--execute');
  if (!encounterId || !term) throw new Error('args: <encounterId> "<search term>" [--execute]');

  const token = await getToken();

  const resources = await zap('get-create-in-house-lab-order-resources', token, { encounterId });
  const labs: any[] = resources?.labs ?? [];
  console.log(`providerName: ${JSON.stringify(resources?.providerName)}`);
  console.log(`catalog (${labs.length}): ${labs.map((l) => l.name).join(', ')}`);

  const matches = match(term, [], labs, (l) => l.name);
  console.log(`\nmatches for "${term}" (best first): ${matches.map((m) => m.name).join(' | ') || '(none)'}`);
  if (!matches.length) {
    console.log('NO MATCH — dispatch would set conv=skipped.');
    return;
  }
  const test = matches[0];
  console.log(`\nwould order: ${test.name}  (adUrl=${test.adUrl}, adId=${test.adId})`);

  if (!execute) {
    console.log('\n(dry run — pass --execute to actually create the order)');
    return;
  }

  const res = await zap('create-in-house-lab-order', token, {
    encounterId,
    testItems: [test],
    diagnosesAll: [],
    diagnosesNew: [],
  });
  console.log('\nORDER CREATED. serviceRequestIds:', JSON.stringify(res?.serviceRequestIds));
}

main().catch((e) => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});
