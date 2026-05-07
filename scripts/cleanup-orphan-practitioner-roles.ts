/**
 * One-off: find PractitionerRoles whose companion Schedule failed to create
 * (a partial-failure state from PractitionerRoleList's "Add role at location"
 * when the IAM role was missing Schedule-create permission). Lists orphans by
 * default; pass --delete to actually delete them.
 *
 * Usage:
 *   npx env-cmd -f apps/ehr/env/tests.local.json \
 *     npx tsx scripts/cleanup-orphan-practitioner-roles.ts          # dry run
 *   npx env-cmd -f apps/ehr/env/tests.local.json \
 *     npx tsx scripts/cleanup-orphan-practitioner-roles.ts --delete # apply
 *
 * "Orphan" = an active PractitionerRole with no Schedule whose actor reference
 * points at it. Filters out PRs that are intentionally schedule-less for
 * reasons unrelated to this bug (none currently — but easy to add a tag-based
 * skip if needed).
 */

import Oystehr from '@oystehr/sdk';
import { PractitionerRole, Schedule } from 'fhir/r4b';

async function getAuthToken(): Promise<string> {
  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw new Error('Missing auth env vars (AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE)');
  }
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
    throw new Error(`Auth failed: HTTP ${response.status}`);
  }
  return (await response.json()).access_token;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--delete');

  const token = await getAuthToken();
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: process.env.FHIR_API!,
    projectApiUrl: process.env.PROJECT_API!,
  });

  // Pull all active PractitionerRoles.
  const roleBundle = await oystehr.fhir.search<PractitionerRole>({
    resourceType: 'PractitionerRole',
    params: [{ name: 'active', value: 'true' }],
  });
  const roles = roleBundle.unbundle();

  // Pull all Schedules whose actor points at any PractitionerRole. We do this
  // in one search and intersect locally rather than N point lookups.
  const schedBundle = await oystehr.fhir.search<Schedule>({
    resourceType: 'Schedule',
    params: [{ name: 'actor', value: 'PractitionerRole' }],
  });
  const schedules = schedBundle.unbundle();
  const rolesWithSchedule = new Set<string>();
  for (const s of schedules) {
    for (const a of s.actor ?? []) {
      const ref = a.reference ?? '';
      if (ref.startsWith('PractitionerRole/')) {
        rolesWithSchedule.add(ref.slice('PractitionerRole/'.length));
      }
    }
  }

  const orphans = roles.filter((r) => r.id && !rolesWithSchedule.has(r.id));

  console.log(`Found ${roles.length} active PractitionerRole(s); ${orphans.length} orphan(s).`);
  if (orphans.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  for (const r of orphans) {
    const practitioner = r.practitioner?.reference ?? '(no practitioner)';
    const location = r.location?.[0]?.reference ?? '(no location)';
    const cats = (r.healthcareService ?? []).map((h) => h.reference).join(', ') || '(none)';
    console.log(`  PractitionerRole/${r.id}  practitioner=${practitioner}  location=${location}  categories=${cats}`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --delete to actually delete the orphans above.');
    return;
  }

  console.log('\nDeleting…');
  let ok = 0;
  let fail = 0;
  for (const r of orphans) {
    try {
      await oystehr.fhir.delete({ resourceType: 'PractitionerRole', id: r.id! });
      console.log(`  deleted PractitionerRole/${r.id}`);
      ok += 1;
    } catch (e) {
      console.error(`  failed PractitionerRole/${r.id}:`, e instanceof Error ? e.message : e);
      fail += 1;
    }
  }
  console.log(`\nDone. deleted=${ok} failed=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
