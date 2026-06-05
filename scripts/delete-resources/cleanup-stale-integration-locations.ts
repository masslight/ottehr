import { input } from '@inquirer/prompts';
import { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Location, Schedule } from 'fhir/r4b';
import { getAllFhirSearchPages } from '../../packages/utils/lib/fhir/getAllFhirSearchPages';
import { createOystehrClient } from '../../packages/utils/lib/main';

/*
 Counts (and eventually deletes) Location resources tagged with
 INTEGRATION_TEST_PROCESS_ID_SYSTEM that haven't been updated in over 24
 hours. These are stale fixtures from integration test runs that the
 cleanup cron missed or that ran outside the cron's scope.

 Currently dry-run only: flip DRY_RUN to enable deletion (not yet wired —
 see the comment near the bottom of main() for what's needed).

 to run:
 npx env-cmd -f config/.env/{ENV}.json tsx scripts/delete-resources/cleanup-stale-integration-locations.ts
*/

// Mirrors INTEGRATION_TEST_PROCESS_ID_SYSTEM in
// packages/zambdas/test/helpers/integration-test-seed-data-setup.ts.
// Inlined here so the script doesn't drag in test-helper transitive imports.
const INTEGRATION_TEST_PROCESS_ID_SYSTEM = 'INTEGRATION_TEST_PROCESS_ID_SYSTEM';

const DRY_RUN = true;
const STALE_AFTER_HOURS = 24;
const SAMPLE_SIZE = 10;
// Per-chunk processing size for deletion. Kept modest so the Schedule
// actor-ref lookup URL stays well under any practical length limit and
// each batch DELETE stays well under any practical request-size limit.
const CHUNK_SIZE = 75;

const { FHIR_API, PROJECT_API, AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;

if (!FHIR_API) throw new Error('FHIR_API environment variable is required.');
if (!PROJECT_API) throw new Error('PROJECT_API environment variable is required.');
if (!AUTH0_ENDPOINT) throw new Error('AUTH0_ENDPOINT environment variable is required.');
if (!AUTH0_CLIENT) throw new Error('AUTH0_CLIENT environment variable is required.');
if (!AUTH0_SECRET) throw new Error('AUTH0_SECRET environment variable is required.');
if (!AUTH0_AUDIENCE) throw new Error('AUTH0_AUDIENCE environment variable is required.');

async function getAuth0Token(): Promise<string> {
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw new Error('Missing Auth0 configuration.');
  }
  console.log('Fetching Auth0 token...');
  const response = await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to get Auth0 token: ${response.statusText}`);
  }
  const data = await response.json();
  return data.access_token;
}

async function main(): Promise<void> {
  if (!FHIR_API || !PROJECT_API) throw new Error('Env not set.');

  const token = await getAuth0Token();
  const oystehr = createOystehrClient(token, FHIR_API, PROJECT_API);

  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000).toISOString();
  console.log(`Tag system:                ${INTEGRATION_TEST_PROCESS_ID_SYSTEM}`);
  console.log(`Cutoff (_lastUpdated lt):  ${cutoff}`);
  console.log(`Mode:                      ${DRY_RUN ? 'DRY RUN (count only)' : 'DELETE'}`);
  console.log('');

  const stale = await getAllFhirSearchPages<Location>(
    {
      resourceType: 'Location',
      params: [
        { name: '_tag', value: `${INTEGRATION_TEST_PROCESS_ID_SYSTEM}|` },
        { name: '_lastUpdated', value: `lt${cutoff}` },
      ],
    },
    oystehr
  );

  console.log(`Found ${stale.length} stale Location(s) older than ${STALE_AFTER_HOURS}h.`);

  if (stale.length > 0) {
    // Unique process-id codes — useful for spotting whether the cruft came
    // from a handful of bad runs or has been accumulating across many.
    const codes = new Set<string>();
    for (const loc of stale) {
      const code = loc.meta?.tag?.find((t) => t.system === INTEGRATION_TEST_PROCESS_ID_SYSTEM)?.code;
      if (code) codes.add(code);
    }
    console.log(`Spanning ${codes.size} unique process-id code(s).`);

    const sample = stale.slice(0, SAMPLE_SIZE);
    console.log(`\nFirst ${sample.length} (id | name | _lastUpdated):`);
    for (const loc of sample) {
      console.log(`  ${loc.id ?? '?'} | ${loc.name ?? '(no name)'} | ${loc.meta?.lastUpdated ?? '?'}`);
    }
    if (stale.length > sample.length) {
      console.log(`  ...and ${stale.length - sample.length} more.`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY_RUN=true; nothing deleted. Flip the constant at the top to enable deletion.');
    return;
  }

  // Deletion path. For each chunk of Locations:
  //   1. Fetch every Schedule actor-referencing any Location in the chunk.
  //   2. Send a single batch DELETE — Schedules first (so any server-side
  //      referential-integrity check sees the child removed before the
  //      parent would dangle), Locations second.
  // Per-chunk failures are logged and skipped; the next chunk continues.
  //
  // Scope: this script only handles Locations and their actor-ref
  // Schedules. Other integration-test resources tagged with the same
  // system (Appointments, PractitionerRoles, etc.) are not touched here —
  // clean those up separately if needed.
  console.log(`\nAbout to delete ${stale.length} Location(s) (plus their Schedules) in chunks of ${CHUNK_SIZE}.`);
  console.log('This action cannot be undone.');
  console.log('');
  await input({
    message: 'Type "yes" to confirm deletion:',
    validate: (val) => val === 'yes' || 'Please type "yes" to confirm',
  });

  const totalChunks = Math.ceil(stale.length / CHUNK_SIZE);
  let deletedLocations = 0;
  let deletedSchedules = 0;
  let chunkFailures = 0;

  for (let i = 0; i < stale.length; i += CHUNK_SIZE) {
    const chunk = stale.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    console.log(`\n[${chunkIndex}/${totalChunks}] Chunk of ${chunk.length} Location(s)...`);

    let relatedSchedules: Schedule[] = [];
    try {
      const actorRefs = chunk.map((loc) => `Location/${loc.id}`).join(',');
      relatedSchedules = (
        await oystehr.fhir.search<Schedule>({
          resourceType: 'Schedule',
          params: [{ name: 'actor', value: actorRefs }],
        })
      ).unbundle();
    } catch (e) {
      console.error('  Failed to fetch related Schedules; skipping chunk:', e);
      chunkFailures += 1;
      continue;
    }

    const batchRequests: BatchInputDeleteRequest[] = [
      ...relatedSchedules.map((s) => ({
        method: 'DELETE' as const,
        url: `Schedule/${s.id}`,
      })),
      ...chunk.map((loc) => ({
        method: 'DELETE' as const,
        url: `Location/${loc.id}`,
      })),
    ];

    try {
      await oystehr.fhir.batch({ requests: batchRequests });
      deletedLocations += chunk.length;
      deletedSchedules += relatedSchedules.length;
      console.log(`  Deleted ${chunk.length} Location(s) + ${relatedSchedules.length} Schedule(s).`);
    } catch (e) {
      console.error('  Batch delete failed; skipping chunk:', e);
      chunkFailures += 1;
    }
  }

  console.log(
    `\nDone. Deleted ${deletedLocations} Location(s) and ${deletedSchedules} Schedule(s).${
      chunkFailures > 0 ? ` ${chunkFailures} chunk failure(s).` : ''
    }`
  );
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
