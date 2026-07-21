/**
 * One-off: refile the vaginal-vestibule exam notes in the seeded Dysuria/Vaginitis
 * global templates from "Rectal comment" to "GU (Female) comment" (mirrors the
 * seed-data fix in global-templates-seed.json for environments seeded before it).
 *
 * Usage: npx env-cmd -f packages/zambdas/.env/synth.json npx tsx <this file> [--execute]
 */
import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';

const isExecute = process.argv.includes('--execute');

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function main(): Promise<void> {
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
    services: { projectApiUrl: need('PROJECT_API') },
  });

  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'title', value: 'Dysuria,Vaginitis' }],
    })
  ).unbundle();

  for (const list of lists) {
    let changed = false;
    for (const c of list.contained ?? []) {
      if (c.resourceType !== 'Observation') continue;
      const note = (c.note?.[0]?.text ?? '').toLowerCase();
      const tag = c.meta?.tag?.find(
        (t) => t.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field'
      );
      if (note.includes('vaginal vestibule') && tag?.code === 'rectal-comment') {
        console.log(`${list.title} (List/${list.id}): "${c.note?.[0]?.text}" rectal-comment → gu-female-comment`);
        tag.code = 'gu-female-comment';
        if (c.code) c.code.text = 'GU (Female) comment';
        changed = true;
      }
    }
    if (!changed) {
      console.log(`${list.title} (List/${list.id}): nothing to fix`);
      continue;
    }
    if (!isExecute) {
      console.log('(dry-run — pass --execute to update)');
      continue;
    }
    await oystehr.fhir.update(list);
    console.log(`Updated List/${list.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
