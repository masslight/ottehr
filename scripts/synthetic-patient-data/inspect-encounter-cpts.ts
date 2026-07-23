import { createOystehrFromEnv } from './shared/oystehr-client';
const encounterId = process.argv[2];
async function main(): Promise<void> {
  const oystehr = await createOystehrFromEnv();
  const procs = (
    await oystehr.fhir.search({
      resourceType: 'Procedure',
      params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    })
  ).unbundle();
  console.log(`Procedures on Encounter/${encounterId}: ${procs.length}`);
  for (const p of procs as any[]) {
    const code = p.code?.coding?.[0];
    const cat = p.category?.coding?.[0];
    console.log(
      `  id=${p.id} code=${code?.system}|${code?.code} (${code?.display}) cat=${cat?.code} status=${p.status}`
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
