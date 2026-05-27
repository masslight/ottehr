import { OYSTEHR_AUTH_TOKEN } from './setup.config';

const ZAMBDA_API = 'https://zambda-api.zapehr.com/v1/zambda';

async function deleteAllZambdas(projectId: string, authToken: string): Promise<void> {
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${authToken}`,
    'x-oystehr-project-id': projectId,
    'x-zapehr-project-id': projectId,
  };

  console.log(`Fetching zambdas for project ${projectId}...`);
  const res = await fetch(ZAMBDA_API, { headers });
  if (!res.ok) {
    throw new Error(`Failed to list zambdas (${res.status}): ${await res.text()}`);
  }

  const zambdas = (await res.json()) as { id: string; name: string }[];
  console.log(`Found ${zambdas.length} zambda(s).`);

  if (zambdas.length === 0) return;

  let deleted = 0;
  let failed = 0;
  for (const zambda of zambdas) {
    const delRes = await fetch(`${ZAMBDA_API}/${zambda.id}`, { method: 'DELETE', headers });
    if (delRes.ok || delRes.status === 404) {
      console.log(`  Deleted: ${zambda.name} (${zambda.id})`);
      deleted++;
    } else {
      console.error(`  FAILED to delete ${zambda.name} (${zambda.id}): ${delRes.status} ${await delRes.text()}`);
      failed++;
    }
  }

  console.log(`\nDone: ${deleted} deleted, ${failed} failed.`);
  if (failed > 0) throw new Error(`${failed} zambda(s) could not be deleted.`);
}

async function deleteZambdasByName(projectId: string, authToken: string, names: string[]): Promise<void> {
  if (names.length === 0) return;

  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${authToken}`,
    'x-oystehr-project-id': projectId,
    'x-zapehr-project-id': projectId,
  };

  console.log(`Fetching zambdas for project ${projectId}...`);
  const res = await fetch(ZAMBDA_API, { headers });
  if (!res.ok) throw new Error(`Failed to list zambdas (${res.status}): ${await res.text()}`);

  const zambdas = (await res.json()) as { id: string; name: string }[];
  console.log(`Available zambdas: ${zambdas.map((z) => z.name).join(', ')}`);

  const nameSetLower = new Set(names.map((n) => n.toLowerCase()));
  const targets = zambdas.filter((z) => nameSetLower.has(z.name.toLowerCase()));

  console.log(`Deleting ${targets.length} conflicting zambda(s)...`);
  for (const zambda of targets) {
    const delRes = await fetch(`${ZAMBDA_API}/${zambda.id}`, { method: 'DELETE', headers });
    if (delRes.ok || delRes.status === 404) {
      console.log(`  Deleted: ${zambda.name}`);
    } else {
      console.error(`  FAILED to delete ${zambda.name}: ${delRes.status} ${await delRes.text()}`);
    }
  }
}

export { deleteAllZambdas, deleteZambdasByName };

// CLI entry — only runs when invoked directly
const isCli = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('delete-zambdas.ts');
if (isCli) {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Usage: tsx delete-zambdas.ts <project-id>');
    process.exit(1);
  }
  deleteAllZambdas(projectId, OYSTEHR_AUTH_TOKEN).catch((err) => {
    console.error('ERROR:', err.message || err);
    process.exit(1);
  });
}
