/**
 * dump-template.ts — find an easy-chart template (FHIR List) by title and print the clinical
 * resources it references (diagnoses/Conditions+ICD-10, exam Observations, etc.), so we can see
 * what apply-template puts on the chart.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/dump-template.ts "AOM Left"
 */
import Oystehr from '@oystehr/sdk';

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

const GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/global-template-in-person';

async function main(): Promise<void> {
  const wantTitle = (process.argv[2] || '').toLowerCase();

  const tokenRes = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenRes.ok) throw new Error(`auth failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    fhirApiUrl: need('FHIR_API').replace(/\/r4/g, ''),
    projectApiUrl: need('PROJECT_API'),
  } as any);

  // All in-person template Lists
  const lists = (
    await oystehr.fhir.search<any>({
      resourceType: 'List',
      params: [{ name: '_count', value: '200' }],
    })
  ).unbundle() as any[];

  const templates = lists.filter(
    (l) => l.code?.coding?.some((c: any) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM)
  );
  console.log(`Found ${templates.length} in-person templates`);
  console.log('Titles:', JSON.stringify(templates.map((t) => t.title).sort()));

  const match = templates.find((t) => (t.title || '').toLowerCase() === wantTitle);
  if (!match) {
    console.log(`\nNo exact match for "${process.argv[2]}".`);
    return;
  }

  console.log(`\n=== Template "${match.title}" (List/${match.id}) ===`);
  const entries: any[] = match.entry ?? [];
  console.log(`${entries.length} referenced resources. Resolving...\n`);

  for (const e of entries) {
    const ref: string = e.item?.reference ?? '';
    const [rt, id] = ref.split('/');
    if (!rt || !id) {
      console.log(`  (unresolvable entry) ${JSON.stringify(e.item)}`);
      continue;
    }
    try {
      const r = (await oystehr.fhir.get({ resourceType: rt as any, id })) as any;
      if (rt === 'Condition') {
        const code = r.code?.coding?.[0];
        const rank = r.extension?.find((x: any) => /rank|primary/i.test(x.url))?.valueString;
        console.log(
          `  [Condition] ${r.code?.text ?? code?.display ?? ''}  ICD10=${code?.code ?? '?'}  ${rank ? `(${rank})` : ''}`
        );
      } else if (rt === 'Observation') {
        const f = r.code?.text ?? r.code?.coding?.[0]?.display ?? r.code?.coding?.[0]?.code ?? '';
        const val =
          r.valueString ??
          (typeof r.valueBoolean === 'boolean' ? String(r.valueBoolean) : r.valueCodeableConcept?.text);
        console.log(`  [Observation] ${f}${val !== undefined ? ` = ${String(val).slice(0, 80)}` : ''}`);
      } else if (rt === 'ServiceRequest') {
        console.log(`  [ServiceRequest/procedure] ${r.code?.text ?? r.code?.coding?.[0]?.display ?? ''}`);
      } else if (rt === 'ChargeItem') {
        console.log(`  [ChargeItem/CPT] ${r.code?.coding?.map((c: any) => `${c.code} ${c.display ?? ''}`).join('; ')}`);
      } else {
        console.log(`  [${rt}] id=${id}`);
      }
    } catch (err) {
      console.log(`  [${rt}/${id}] resolve failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
