import { List } from 'fhir/r4b';
import { createOystehrClient, GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM } from '../../packages/utils/lib/main';

/*
  Cleans up duplicate global-template List resources.

  The global-templates holder list references the "canonical" template Lists by ID.
  If duplicate Lists exist with the same title but are NOT referenced by the holder,
  they cause errors in apply-template (which searches by title and expects exactly one match).

  This script:
    1. Fetches the global-templates holder list
    2. For each template referenced by the holder, searches for all Lists with the same title
    3. Deletes the duplicates that are NOT referenced by the holder

  Usage:
    npx env-cmd -f packages/zambdas/.env/{ENV}.json tsx scripts/delete-resources/cleanup-duplicate-global-templates.ts [--dry-run]

  Options:
    --dry-run   Print what would be deleted without actually deleting anything (default behavior)
    --execute   Actually perform the deletions
*/

const { FHIR_API, PROJECT_API, AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;

if (!FHIR_API) throw new Error('FHIR_API environment variable is required.');
if (!PROJECT_API) throw new Error('PROJECT_API environment variable is required.');
if (!AUTH0_ENDPOINT) throw new Error('AUTH0_ENDPOINT environment variable is required.');
if (!AUTH0_CLIENT) throw new Error('AUTH0_CLIENT environment variable is required.');
if (!AUTH0_SECRET) throw new Error('AUTH0_SECRET environment variable is required.');
if (!AUTH0_AUDIENCE) throw new Error('AUTH0_AUDIENCE environment variable is required.');

const isDryRun = !process.argv.includes('--execute');

async function getAuth0Token(): Promise<string> {
  console.log('Fetching Auth0 token...');
  const response = await fetch(AUTH0_ENDPOINT!, {
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
  if (isDryRun) {
    console.log('=== DRY RUN MODE (pass --execute to actually delete) ===\n');
  } else {
    console.log('=== EXECUTE MODE — duplicates will be deleted ===\n');
  }

  const token = await getAuth0Token();
  const oystehr = createOystehrClient(token, FHIR_API!, PROJECT_API!);

  // Step 1: Find the global-templates holder list
  console.log('Searching for global-templates holder list...');
  const holderLists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: '_tag', value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|` }],
    })
  ).unbundle();

  const holderList = holderLists.find(
    (l) => l.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM)
  );

  if (!holderList) {
    console.error('Global-templates holder list not found.');
    process.exit(1);
  }

  console.log(`Found holder list: ${holderList.id}`);

  if (!holderList.entry?.length) {
    console.log('Holder list has no entries. Nothing to do.');
    return;
  }

  // Step 2: Extract the canonical template IDs from the holder
  const canonicalIds = new Set(
    holderList.entry.map((entry) => entry.item.reference?.replace('List/', '')).filter((id): id is string => !!id)
  );

  console.log(`Holder references ${canonicalIds.size} template(s).\n`);

  // Step 3: Fetch the canonical templates to get their titles
  const idArray = [...canonicalIds];
  const chunkSize = 50;
  const canonicalTemplates: List[] = [];

  for (let i = 0; i < idArray.length; i += chunkSize) {
    const chunk = idArray.slice(i, i + chunkSize);
    const results = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [
          { name: '_id', value: chunk.join(',') },
          { name: '_count', value: '50' },
        ],
      })
    ).unbundle();
    canonicalTemplates.push(...results);
  }

  // Step 4: For each canonical template, search by title and find duplicates
  let totalKept = 0;
  let totalToDelete = 0;
  const deletions: { id: string; title: string }[] = [];

  const uniqueTitles = new Map<string, string>(); // title -> canonical ID
  for (const template of canonicalTemplates) {
    if (template.title && template.id) {
      uniqueTitles.set(template.title, template.id);
    }
  }

  console.log(`Checking ${uniqueTitles.size} unique template title(s) for duplicates...\n`);

  for (const [title, _canonicalId] of uniqueTitles) {
    // Search for all Lists with this exact title
    const listsWithTitle = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [
          { name: 'title', value: title },
          { name: '_count', value: '100' },
        ],
      })
    ).unbundle();

    // Filter to only Lists that actually match the title exactly (FHIR search can be fuzzy)
    const exactMatches = listsWithTitle.filter((l) => l.title === title);

    if (exactMatches.length <= 1) {
      console.log(`"${title}" — no duplicates found`);
      totalKept++;
      continue;
    }

    // Separate into kept (referenced by holder) and duplicates (not referenced)
    const kept = exactMatches.filter((l) => canonicalIds.has(l.id!));
    const dupes = exactMatches.filter((l) => !canonicalIds.has(l.id!));

    console.log(`"${title}"`);
    console.log(`  KEEP:   ${kept.map((l) => l.id).join(', ')} (referenced by holder)`);
    console.log(`  DELETE: ${dupes.map((l) => l.id).join(', ')} (${dupes.length} duplicate(s))`);

    totalKept += kept.length;
    totalToDelete += dupes.length;
    deletions.push(...dupes.map((l) => ({ id: l.id!, title })));
  }

  console.log(`\n--- Summary ---`);
  console.log(`Templates to keep:   ${totalKept}`);
  console.log(`Duplicates to delete: ${totalToDelete}`);

  if (deletions.length === 0) {
    console.log('\nNo duplicates found. Nothing to do.');
    return;
  }

  if (isDryRun) {
    console.log('\nDry run complete. No resources were deleted.');
    console.log('Run with --execute to delete the duplicates.');
    return;
  }

  // Step 5: Delete the duplicates
  console.log(`\nDeleting ${deletions.length} duplicate(s)...`);

  for (const { id, title } of deletions) {
    try {
      await oystehr.fhir.delete({ resourceType: 'List', id });
      console.log(`  Deleted List/${id} ("${title}")`);
    } catch (error) {
      console.error(`  Failed to delete List/${id} ("${title}"):`, error);
    }
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
