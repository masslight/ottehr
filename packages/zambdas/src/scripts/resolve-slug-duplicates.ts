import { input } from '@inquirer/prompts';
import { default as Oystehr } from '@oystehr/sdk';
import { FhirResource, PractitionerRole, Schedule } from 'fhir/r4b';
import { SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { isFhirNotFoundError } from '../shared/errors';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

/**
 * Resolves slug collisions among the runtime-seeded anchor types, keeping the copy that is actually
 * in use and removing the rest.
 *
 * Companion to `dedupe-scheduling-resources`, which keeps the OLDEST copy and refuses outright to
 * touch any duplicate that has Appointments. That rule is unsafe once duplicates have been around
 * long enough to take traffic: measured on staging, oldest-wins would have deleted a Location
 * holding 252 Appointments and a Practitioner holding 779, while keeping copies with 1 and 2. Age
 * does not track liveness — roughly half the collisions there are newest-is-live.
 *
 * This picks the keeper by **Appointment count** (ties broken by oldest), which is the signal that
 * actually identifies the live resource, then reports exactly how many references (Appointment AND
 * Encounter) the plan would orphan before doing anything.
 *
 *   npm run resolve-slug-duplicates -- <env>                     # dry run (default)
 *   npm run resolve-slug-duplicates -- <env> --verify            # post-hoc integrity scan
 *   npm run resolve-slug-duplicates -- <env> --repoint --apply   # recommended
 *   npm run resolve-slug-duplicates -- <env> --apply             # delete, leaving dangling refs
 *   npm run resolve-slug-duplicates -- <env> --deslug --apply    # keep them, just remove their slug
 *
 * Strategies:
 *   --repoint (recommended) — rewrites every Appointment / Encounter reference from the losing copy
 *                       to the keeper, THEN deletes. Same-slug duplicates are meant to be the same
 *                       place, so the pointer is corrected rather than severed: nothing is left
 *                       dangling and no visit data is destroyed.
 *   delete  (default) — removes the losing anchors and their dependent Schedules /
 *                       PractitionerRoles, leaving referring resources pointing at a tombstone.
 *                       Reported and capped rather than silent.
 *   --deslug          — strips only the slug identifier, so the copy stops resolving for booking but
 *                       every reference stays intact. Reversible; the gentlest option, at the cost
 *                       of leaving unreachable resources behind. Verified safe against the code:
 *                       every slug consumer skips or defaults on absence (list-bookables,
 *                       BookableSelect, get-schedule's pickable list, ehr/schedules/get-schedule,
 *                       the admin form), and slug-less anchor Locations are already a supported shape.
 *
 * NOT covered by --repoint: anything outside Appointment and Encounter. Schedules and
 * PractitionerRoles belonging to a losing copy are deleted as dependents rather than repointed
 * (the keeper has its own), and no attempt is made to merge duplicate Schedules.
 *
 * Safety: without --repoint, aborts if the plan would strand more than `--max-orphans` references
 * (default 25). Raise it deliberately, having read the report — that cap is the thing standing
 * between a routine cleanup and a data-loss incident.
 */

const ANCHOR_TYPES = ['Location', 'HealthcareService', 'Practitioner'] as const;
type AnchorType = (typeof ANCHOR_TYPES)[number];

const APPLY = process.argv.includes('--apply');
const DESLUG = process.argv.includes('--deslug');
const REPOINT = process.argv.includes('--repoint');
const VERIFY = process.argv.includes('--verify');

const numericArg = (flag: string, fallback: number): number => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const parsed = Number(process.argv[idx + 1]);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} needs a non-negative number, got: ${process.argv[idx + 1]}`);
  }
  return parsed;
};

const MAX_ORPHANS = numericArg('--max-orphans', 25);

const slugOf = (resource: FhirResource): string | undefined =>
  (resource as { identifier?: { system?: string; value?: string }[] }).identifier?.find(
    (id) => id.system === SLUG_SYSTEM
  )?.value;

const updatedAt = (resource: FhirResource): number => Date.parse(resource.meta?.lastUpdated ?? '') || 0;

const appointmentCount = async (oystehr: Oystehr, type: AnchorType, id: string): Promise<number> => {
  const found = await oystehr.fhir.search({
    resourceType: 'Appointment',
    params: [
      { name: 'actor', value: `${type}/${id}` },
      { name: '_summary', value: 'count' },
    ],
  });
  return found.total ?? 0;
};

/**
 * Everywhere a visit resource points back at one of these anchors.
 *
 * Appointments are not the whole story, and assuming they were badly undercounts the blast radius:
 * on staging one duplicate Practitioner carried 2 Appointments but **68** Encounters. Each entry
 * names the array field holding the reference, which is rewritten wholesale rather than by index —
 * JSON Patch array indices are fragile, and a whole-field `replace` is atomic.
 */
interface ReferenceSource {
  resourceType: 'Appointment' | 'Encounter';
  /** Search param that finds resources pointing at the anchor. */
  searchParam: string;
  /** Top-level array field on the referring resource that holds the reference. */
  field: 'participant' | 'location';
  /** Property within each array entry carrying the Reference. */
  refKey: 'actor' | 'individual' | 'location';
}

const REFERENCE_SOURCES: Record<AnchorType, ReferenceSource[]> = {
  Location: [
    { resourceType: 'Appointment', searchParam: 'actor', field: 'participant', refKey: 'actor' },
    { resourceType: 'Encounter', searchParam: 'location', field: 'location', refKey: 'location' },
  ],
  Practitioner: [
    { resourceType: 'Appointment', searchParam: 'actor', field: 'participant', refKey: 'actor' },
    { resourceType: 'Encounter', searchParam: 'participant', field: 'participant', refKey: 'individual' },
  ],
  // Encounter has no HealthcareService participant/location link in this model; Appointments are the
  // only visit-level referrer. PractitionerRoles and Schedules that name it are deleted as dependents.
  HealthcareService: [{ resourceType: 'Appointment', searchParam: 'actor', field: 'participant', refKey: 'actor' }],
};

const referrersOf = async (oystehr: Oystehr, type: AnchorType, id: string): Promise<Map<ReferenceSource, any[]>> => {
  const out = new Map<ReferenceSource, any[]>();
  for (const source of REFERENCE_SOURCES[type]) {
    const found = await getAllFhirSearchPages<any>(
      { resourceType: source.resourceType, params: [{ name: source.searchParam, value: `${type}/${id}` }] },
      oystehr
    );
    if (found.length) out.set(source, found);
  }
  return out;
};

/**
 * Rewrites references to `fromRef` so they name `toRef` instead.
 *
 * Duplicate-safe: if the resource already references the keeper, the redundant entry is dropped
 * rather than leaving the same actor listed twice. Same-slug duplicates are meant to be the same
 * place, so this corrects the pointer rather than severing it.
 */
const repointResource = async (
  oystehr: Oystehr,
  source: ReferenceSource,
  resource: any,
  fromRef: string,
  toRef: string
): Promise<void> => {
  const entries: any[] = resource[source.field] ?? [];
  const rewritten = entries.map((entry) =>
    entry?.[source.refKey]?.reference === fromRef
      ? { ...entry, [source.refKey]: { ...entry[source.refKey], reference: toRef } }
      : entry
  );

  const seen = new Set<string>();
  const deduped = rewritten.filter((entry) => {
    const ref = entry?.[source.refKey]?.reference;
    if (!ref) return true;
    if (seen.has(ref)) return false;
    seen.add(ref);
    return true;
  });

  await oystehr.fhir.patch({
    resourceType: source.resourceType,
    id: resource.id,
    operations: [{ op: 'replace', path: `/${source.field}`, value: deduped }],
  } as any);
};

interface Candidate {
  type: AnchorType;
  resource: FhirResource;
  appointments: number;
}

/**
 * Post-hoc integrity check: walks every Appointment and Encounter and reports any that still name a
 * resource which no longer exists.
 *
 * Deliberately a full scan rather than a reference search. Searching *by* a reference whose target
 * has been deleted does not return trustworthy results on this server — after a real, correct
 * cleanup, `actor=Location/<deleted-id>` with `_summary=count` reported lingering references that a
 * direct scan proved were not there. Anything verifying the outcome of a deletion has to read the
 * resources themselves.
 *
 * Slower (it pages the whole visit graph), which is why it is opt-in rather than part of every run.
 */
const verifyNoDanglingRefs = async (oystehr: Oystehr): Promise<void> => {
  console.log('\nScanning Appointments and Encounters for references to deleted resources...');

  const existsCache = new Map<string, boolean>();
  const stillExists = async (ref: string): Promise<boolean> => {
    const cached = existsCache.get(ref);
    if (cached !== undefined) return cached;
    const [resourceType, id] = ref.split('/');
    let found = true;
    try {
      await oystehr.fhir.get({ resourceType: resourceType as any, id });
    } catch (error) {
      // ONLY a 404 means "deleted". Treating every error as absence would let a timeout or a
      // permissions blip manufacture dangling references — which is the precise failure this whole
      // mode exists to rule out. A scan that can invent findings under load is worse than no scan,
      // so anything else aborts rather than being folded into the report.
      if (!isFhirNotFoundError(error)) {
        throw new Error(
          `VERIFY aborted: could not determine whether ${ref} exists (this is not a 404). ` +
            'Results so far are incomplete and must not be read as a clean bill of health.',
          { cause: error }
        );
      }
      found = false;
    }
    existsCache.set(ref, found);
    return found;
  };

  // Only the anchor types this script removes; a broken reference to anything else is not ours.
  const relevant = (ref: string | undefined): ref is string =>
    !!ref && ANCHOR_TYPES.some((type) => ref.startsWith(`${type}/`));

  let scanned = 0;
  // Grouped by the missing target, not listed per-referrer: a single deleted anchor can strand
  // dozens of Encounters, and one line per referrer buries the thing you actually need to see.
  const byTarget = new Map<string, number>();
  for (const resourceType of ['Appointment', 'Encounter'] as const) {
    const all = await getAllFhirSearchPages<any>({ resourceType, params: [] }, oystehr);
    scanned += all.length;
    for (const resource of all) {
      const refs = [
        ...(resource.participant ?? []).map((p: any) => p.actor?.reference ?? p.individual?.reference),
        ...(resource.location ?? []).map((l: any) => l.location?.reference),
      ].filter(relevant);
      for (const ref of new Set(refs)) {
        if (!(await stillExists(ref))) byTarget.set(ref, (byTarget.get(ref) ?? 0) + 1);
      }
    }
  }

  const broken = [...byTarget.values()].reduce((sum, n) => sum + n, 0);
  if (broken === 0) {
    console.log(`\nClean: scanned ${scanned} resource(s), no dangling references to deleted anchors.`);
    return;
  }

  console.log(`\n${broken} dangling reference(s) across ${scanned} scanned resource(s), by missing target:\n`);
  for (const [ref, count] of [...byTarget.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${ref}`);
  }
  console.log(
    '\nNOTE: dangling references pre-date this tool in most environments — earlier cleanups, manual' +
      '\ndeletions, and expired test data all leave them. Compare these target ids against the ones' +
      '\nthis run deleted; anything else was already broken and is out of scope here.'
  );
};

const main = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);

  if (VERIFY) {
    console.log(`\n=== resolve-slug-duplicates (${config.env}) — VERIFY (read only) ===`);
    await verifyNoDanglingRefs(oystehr);
    return;
  }

  const strategy = DESLUG ? 'DESLUG' : REPOINT ? 'REPOINT+DELETE' : 'DELETE';

  console.log(`\n=== resolve-slug-duplicates (${config.env}) — ${APPLY ? 'APPLY' : 'DRY-RUN'} / ${strategy} ===`);
  console.log(`Keeper: most Appointments (ties -> oldest).  Abort if > ${MAX_ORPHANS} references orphaned.\n`);

  const losers: Candidate[] = [];
  const keeperByKey = new Map<string, string>();
  const loserRefs = new Set<string>();
  let orphanedReferences = 0;

  for (const type of ANCHOR_TYPES) {
    const all = await getAllFhirSearchPages<FhirResource>({ resourceType: type }, oystehr);
    const bySlug = new Map<string, FhirResource[]>();
    for (const resource of all) {
      const slug = slugOf(resource);
      if (!slug) continue;
      const list = bySlug.get(slug);
      if (list) list.push(resource);
      else bySlug.set(slug, [resource]);
    }

    for (const [slug, group] of bySlug) {
      if (group.length < 2) continue;

      const withCounts: Candidate[] = [];
      for (const resource of group) {
        withCounts.push({ type, resource, appointments: await appointmentCount(oystehr, type, resource.id!) });
      }
      // Most Appointments wins; oldest breaks ties so repeat runs are deterministic.
      withCounts.sort((a, b) => b.appointments - a.appointments || updatedAt(a.resource) - updatedAt(b.resource));
      const [keeper, ...rest] = withCounts;
      keeperByKey.set(`${type}|${slug}`, `${type}/${keeper.resource.id}`);

      console.log(`${type} "${slug}" — ${group.length} copies`);
      console.log(
        `   ${String(keeper.appointments).padStart(5)} appts  KEEP    ${type}/${keeper.resource.id}  ${(
          keeper.resource.meta?.lastUpdated ?? ''
        ).slice(0, 10)}`
      );
      for (const candidate of rest) {
        console.log(
          `   ${String(candidate.appointments).padStart(5)} appts  ${strategy === 'DESLUG' ? 'DESLUG' : 'DELETE'}  ${
            candidate.type
          }/${candidate.resource.id}  ${(candidate.resource.meta?.lastUpdated ?? '').slice(0, 10)}`
        );
        losers.push(candidate);
        loserRefs.add(`${candidate.type}/${candidate.resource.id}`);
        // Count EVERY referrer, not just Appointments — Encounters routinely outnumber them by an
        // order of magnitude, and counting only Appointments understates the blast radius badly.
        // DESLUG strands nothing (the anchor survives); REPOINT rewrites them before deleting.
        if (!DESLUG) {
          const referrers = await referrersOf(oystehr, candidate.type, candidate.resource.id!);
          let total = 0;
          const parts: string[] = [];
          for (const [source, list] of referrers) {
            total += list.length;
            parts.push(`${list.length} ${source.resourceType}`);
          }
          if (total > 0) {
            console.log(`         └─ referenced by ${parts.join(', ')}${REPOINT ? ' (will be repointed)' : ''}`);
          }
          if (!REPOINT) orphanedReferences += total;
        }
      }
      console.log('');
    }
  }

  if (losers.length === 0) {
    console.log('No slug collisions found. Nothing to do.');
    return;
  }

  // Dependents of a removed anchor, so a deleted Location doesn't leave its Schedules behind holding
  // capacity. Not collected for DESLUG: the anchor survives and its schedules stay valid.
  const dependentRefs: string[] = [];
  if (!DESLUG) {
    const roles = await getAllFhirSearchPages<PractitionerRole>({ resourceType: 'PractitionerRole' }, oystehr);
    const doomed = new Set(loserRefs);
    for (const role of roles) {
      const refs = [
        role.practitioner?.reference,
        ...(role.healthcareService ?? []).map((r) => r.reference),
        ...(role.location ?? []).map((r) => r.reference),
      ];
      if (refs.some((ref) => ref && loserRefs.has(ref))) {
        const ref = `PractitionerRole/${role.id}`;
        dependentRefs.push(ref);
        doomed.add(ref);
      }
    }
    const schedules = await getAllFhirSearchPages<Schedule>({ resourceType: 'Schedule' }, oystehr);
    for (const schedule of schedules) {
      if ((schedule.actor ?? []).some((a) => a.reference && doomed.has(a.reference))) {
        dependentRefs.push(`Schedule/${schedule.id}`);
      }
    }
  }

  console.log(
    `Plan: ${strategy} ${losers.length} duplicate(s)${
      dependentRefs.length ? ` + ${dependentRefs.length} dependent resource(s)` : ''
    }.`
  );
  console.log(
    DESLUG
      ? 'No references are affected — the resources survive, they just stop resolving by slug.'
      : REPOINT
      ? 'References are rewritten to the keeper before deletion, so none are left dangling.'
      : `${orphanedReferences} reference(s) (Appointments + Encounters) would be left dangling.`
  );

  if (!DESLUG && !REPOINT && orphanedReferences > MAX_ORPHANS) {
    console.error(
      `\nABORT: ${orphanedReferences} orphaned references exceeds --max-orphans ${MAX_ORPHANS}.` +
        '\nRe-read the plan above. A high number here usually means the keeper choice is wrong for at' +
        '\nleast one slug, not that the cap is too low. Prefer --repoint (rewrites the references to' +
        '\nthe keeper, leaving none dangling) or --deslug; raise the cap only once you are satisfied' +
        '\nevery KEEP line is the resource actually in use.'
    );
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log(
      `\nDry-run only. Re-run with \`--apply\`${DESLUG ? ' --deslug' : REPOINT ? ' --repoint' : ''} to proceed.`
    );
    return;
  }

  console.log(`\nAbout to ${strategy.toLowerCase()} ${losers.length} resource(s) in ${config.env}.`);
  const answer = await input({ message: 'Type "yes" to confirm:' });
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted; nothing changed.');
    return;
  }

  if (DESLUG) {
    for (const candidate of losers) {
      const identifiers = (candidate.resource as any).identifier ?? [];
      const remaining = identifiers.filter((id: any) => id.system !== SLUG_SYSTEM);
      try {
        await oystehr.fhir.patch({
          resourceType: candidate.type,
          id: candidate.resource.id!,
          operations: [
            remaining.length > 0
              ? { op: 'replace', path: '/identifier', value: remaining }
              : { op: 'remove', path: '/identifier' },
          ],
        } as any);
        console.log(`  de-slugged ${candidate.type}/${candidate.resource.id}`);
      } catch (error) {
        console.error(`  FAILED ${candidate.type}/${candidate.resource.id}:`, error);
      }
    }
  } else {
    if (REPOINT) {
      // Rewrite every referrer to the keeper BEFORE deleting, so nothing is left pointing at a
      // tombstone. Keeper is recomputed here from the same rule used to build the plan.
      const repointFailures: string[] = [];
      for (const candidate of losers) {
        const keeperRef = keeperByKey.get(`${candidate.type}|${slugOf(candidate.resource)}`);
        if (!keeperRef) {
          console.error(`  FAILED repoint ${candidate.type}/${candidate.resource.id}: no keeper resolved`);
          repointFailures.push(`${candidate.type}/${candidate.resource.id} (no keeper resolved)`);
          continue;
        }
        const fromRef = `${candidate.type}/${candidate.resource.id}`;
        const referrers = await referrersOf(oystehr, candidate.type, candidate.resource.id!);
        for (const [source, list] of referrers) {
          for (const referrer of list) {
            try {
              await repointResource(oystehr, source, referrer, fromRef, keeperRef);
              console.log(`  repointed ${source.resourceType}/${referrer.id}  ${fromRef} -> ${keeperRef}`);
            } catch (error) {
              console.error(`  FAILED repoint ${source.resourceType}/${referrer.id}:`, error);
              repointFailures.push(`${source.resourceType}/${referrer.id} -> ${keeperRef}`);
            }
          }
        }
      }

      // Deleting after a failed repoint produces exactly the dangling references --repoint exists to
      // prevent, so a single failure stops the deletion phase for the whole run. Nothing is rolled
      // back: repointing is idempotent and successfully-repointed referrers no longer resolve
      // against the loser, so re-running picks up only what is left and then deletes.
      if (repointFailures.length > 0) {
        console.error(
          `\nABORT: ${repointFailures.length} repoint(s) failed; nothing was deleted.` +
            '\nDeleting now would strand exactly the references --repoint exists to preserve.\n'
        );
        for (const failure of repointFailures) console.error(`  ${failure}`);
        console.error(
          '\nThe repoints that DID succeed are already applied and are safe to keep. Investigate the' +
            '\nfailures above, then re-run the same command — it will repoint only what remains and' +
            '\ndelete once every reference has moved.'
        );
        process.exitCode = 1;
        return;
      }
    }

    // Dependents first so nothing points at a resource that is already gone.
    for (const ref of [...dependentRefs, ...loserRefs]) {
      const [resourceType, id] = ref.split('/');
      try {
        await oystehr.fhir.delete({ resourceType: resourceType as any, id });
        console.log(`  deleted ${ref}`);
      } catch (error) {
        console.error(`  FAILED ${ref}:`, error);
      }
    }
  }

  console.log('\nDone.');
};

performEffectWithEnvFile(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
