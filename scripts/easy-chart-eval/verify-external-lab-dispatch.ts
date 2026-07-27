/**
 * verify-external-lab-dispatch.ts — exercise the exact zambda calls the easy-chart
 * `add-external-lab` dispatch handler makes:
 *   1. external lab resource search {patientId, encounterId} -> coverages, orderingLocations, WC flag
 *   2. external lab resource search {search, labOrgIdsString}  -> orderable items catalog
 *   3. create-lab-order {dx, encounter, orderableItems, psc, orderingLocation, selectedPaymentMethod}
 * to confirm a send-out lab order is created. Resolves office from the encounter's location,
 * matches by item.itemName, and defaults payment WC -> Insurance(if coverage) -> SelfPay.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/easy-chart-eval/verify-external-lab-dispatch.ts <encounterId> "<search term>" [--execute]
 */
import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';

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
  if (!res.ok) throw new Error(`${name} -> ${res.status}: ${text.slice(0, 600)}`);
  return json.output ?? json;
}

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
      let score = 0;
      for (const t of q) {
        if (nt.includes(t)) score += 20;
        else if (nt.some((x) => x.startsWith(t))) score += 5;
      }
      if (getName(item).trim().toLowerCase() === ql) score += 1000;
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
  const oystehr = new Oystehr({
    accessToken: token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  const encounter = (await oystehr.fhir.get({ resourceType: 'Encounter', id: encounterId })) as Encounter;
  const patientId = encounter.subject?.reference?.replace('Patient/', '');
  const encounterLocationId = encounter.location
    ?.find((l) => l.location?.reference?.startsWith('Location/'))
    ?.location?.reference?.replace('Location/', '');
  console.log(`patientId=${patientId}  encounterLocationId=${encounterLocationId}`);

  const resources = await zap('get-create-lab-order-resources', token, { patientId, encounterId });
  const coverages: any[] = resources?.coverages ?? [];
  const orderingLocations: any[] = resources?.orderingLocations ?? [];
  const isWC: boolean = !!resources?.appointmentIsWorkersComp;
  console.log(
    `coverages=${coverages.length}  WC=${isWC}  orderingLocations=${orderingLocations
      .map((l) => `${l.name}(${l.id})[${l.enabledLabs?.map((e: any) => e.labName).join('|')}]`)
      .join(', ')}`
  );

  const office = orderingLocations.find((l) => l.id === encounterLocationId) ?? orderingLocations[0];
  if (!office) {
    console.log('NO ORDERING LOCATION configured for labs — dispatch would skip.');
    return;
  }
  const labOrgIdsString = (office.enabledLabs ?? [])
    .map((e: any) => e.labOrgRef.replace('Organization/', ''))
    .join(',');
  console.log(`selected office: ${office.name} (${office.id})  labOrgIds=${labOrgIdsString}`);

  const searchRes = await zap('get-create-lab-order-resources', token, { search: term, labOrgIdsString });
  const catalog: any[] = searchRes?.labs ?? [];
  console.log(
    `\ncatalog hits for "${term}" (${catalog.length}): ${catalog
      .map((c) => c.item?.itemName)
      .slice(0, 12)
      .join(' | ')}`
  );

  const matches = match(term, [], catalog, (c) => c.item?.itemName ?? '');
  if (!matches.length) {
    console.log('NO MATCH — dispatch would set conv=skipped.');
    return;
  }
  const chosen = matches[0];
  const payment = isWC ? 'workers comp' : coverages.length > 0 ? 'insurance' : 'self pay';
  console.log(`\nwould order: ${chosen.item?.itemName} (${chosen.lab?.labName})  payment=${payment}`);

  if (!execute) {
    console.log('\n(dry run — pass --execute to actually create the order)');
    return;
  }

  const dx = [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified', isPrimary: true }];
  await zap('create-lab-order', token, {
    dx,
    encounter,
    orderableItems: [chosen],
    psc: false,
    orderingLocation: office,
    selectedPaymentMethod: payment,
  });
  console.log('\nORDER CREATED (create-lab-order returned successfully).');
}

main().catch((e) => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});
