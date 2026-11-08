// Adds what the Newborn bilirubin flowsheet reads to synth: an in-house transcutaneous bilirubin (TcB) test built
// the way admin-add-in-house-lab builds it. The flowsheet seed patient's bilirubin results are outside-lab results
// seeded by seed-longitudinal-patient.ts, so nothing else is written.
//
//   npx tsx scripts/flowsheets/add-newborn-bilirubin-test.ts --env synth [--execute]
//
// Without --execute it is a dry run that prints the plan. Re-running makes no further changes.

import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { IN_HOUSE_LAB_LATEST_TAG_DEFINITION } from 'utils/lib/types/data/in-house/in-house.constants';
import { AdminInHouseLabItemDefinitionSchema } from 'utils/lib/types/data/in-house/in-house.schema';
import { AdminInHouseLabItemDefinition, QuantityComponent } from 'utils/lib/types/data/in-house/in-house.types';
import {
  convertAdminInHouseLabItemDefinitionToActivityDefinition,
  getInHouseLabTestUrlAndVersion,
  incrementSemVer,
  parseSemVer,
  semverToString,
} from '../../packages/zambdas/src/ehr/lab/shared/in-house-labs';
import { arg, flag } from '../synthetic-patient-data/shared/cli';
import { createOystehrFromEnvFile } from '../synthetic-patient-data/shared/oystehr-client';

const ENV = arg('--env', 'synth');
const EXECUTE = flag('--execute');

// ---- In-house test ------------------------------------------------------------------------------
// Transcutaneous bilirubin has no single age-independent normal range, and Ottehr's result entry needs a two-sided
// range for every numeric component, so the range is the meter's measuring range: "The measuring range is defined
// to 340 µmol/L / 20 mg/dl" (Dräger, Important Safety Notice "Dräger Jaundice Meter JM-105 Out of Range
// Indication", March 2018), from "0.0 µmol/L" (Dräger JM-105 User Quick Reference Guide, p. 5). The meter reads to
// 0.1 mg/dL. CPT 88720 "Bilirubin, total, transcutaneous" is an in vivo laboratory procedure, not a CLIA-waived
// specimen test, so it carries no QW modifier.
const numeric = (
  componentName: string,
  loinc: string,
  normalRange: QuantityComponent['normalRange']
): QuantityComponent => ({
  componentName,
  loincCode: [loinc],
  dataType: 'Quantity',
  normalRange,
  display: { type: 'Numeric', nullOption: false },
});
const TCB_POC: AdminInHouseLabItemDefinition = {
  name: 'Transcutaneous bilirubin POC',
  methods: { analyzer: { device: 'Dräger Jaundice Meter JM-105' } },
  cptCode: [{ code: '88720', display: 'Bilirubin, total, transcutaneous' }],
  repeatTest: false,
  components: [numeric('Transcutaneous bilirubin', '58941-6', { low: 0, high: 20, unit: 'mg/dL', precision: 1 })],
};

/** The parts of a test definition that its version carries; id, url, version and tags are left out. */
const definitionBody = (ad: ActivityDefinition): string => {
  const { code, title, name, participant, observationRequirement, contained, relatedArtifact, extension } = ad;
  const sortKeys = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sortKeys)
      : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, sortKeys(v)])
        )
      : value;
  return JSON.stringify(
    sortKeys({ code, title, name, participant, observationRequirement, contained, relatedArtifact, extension })
  );
};

const compareVersions = (a: string, b: string): number => {
  const [am, an, ap] = a.split('.').map(Number);
  const [bm, bn, bp] = b.split('.').map(Number);
  return am - bm || an - bn || ap - bp;
};

/**
 * The test at the definition's canonical url, as the admin pages would leave it: created at 1.0.0 when the
 * practice has none (admin-add-in-house-lab); otherwise, when the latest version differs, a new patch version
 * is created and every active version retired and stripped of its "latest" tag (admin-update-in-house-lab).
 */
async function ensureInHouseTest(oystehr: Oystehr, definition: AdminInHouseLabItemDefinition): Promise<void> {
  AdminInHouseLabItemDefinitionSchema.parse(definition);
  const { url } = getInHouseLabTestUrlAndVersion(definition, {});
  const existing = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [{ name: 'url', value: url }],
    })
  )
    .unbundle()
    .sort((a, b) => compareVersions(a.version ?? '0.0.0', b.version ?? '0.0.0'));
  const draft = convertAdminInHouseLabItemDefinitionToActivityDefinition(definition);
  const latest = existing[existing.length - 1];
  if (latest && definitionBody(latest) === definitionBody(draft)) {
    console.log(`ActivityDefinition/${latest.id} ${url}|${latest.version} already matches — nothing to do`);
    return;
  }

  const version = latest?.version ? semverToString(incrementSemVer(parseSemVer(latest.version), 'patch')) : '1.0.0';
  const activityDefinition: ActivityDefinition = {
    ...draft,
    url,
    version,
    meta: { ...(draft.meta ?? {}), tag: [...(draft.meta?.tag ?? []), IN_HOUSE_LAB_LATEST_TAG_DEFINITION] },
  };
  const active = existing.filter((ad) => ad.status === 'active');
  console.log(
    `${EXECUTE ? 'Creating' : 'Would create'} in-house test "${definition.name}" ${url}|${version}; ${
      EXECUTE ? 'retiring' : 'would retire'
    } ${active.map((ad) => `ActivityDefinition/${ad.id} (${ad.version})`).join(', ') || 'nothing'}`
  );
  if (!EXECUTE) return;

  const requests: (BatchInputPostRequest<ActivityDefinition> | BatchInputPatchRequest<ActivityDefinition>)[] = [
    ...active.map((ad): BatchInputPatchRequest<ActivityDefinition> => {
      const tagsMinusLatest = (ad.meta?.tag ?? []).filter(
        (tag) =>
          !(
            tag.system === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system &&
            tag.code === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code
          )
      );
      return {
        method: 'PATCH',
        url: `ActivityDefinition/${ad.id}`,
        operations: [
          { op: 'replace', path: '/status', value: 'retired' },
          tagsMinusLatest.length
            ? { op: 'replace', path: '/meta/tag', value: tagsMinusLatest }
            : { op: 'remove', path: '/meta/tag' },
        ],
      };
    }),
    { method: 'POST', url: '/ActivityDefinition', resource: activityDefinition },
  ];
  const result = (await oystehr.fhir.transaction<ActivityDefinition>({ requests })).unbundle();
  const created = result.find((ad) => ad.resourceType === 'ActivityDefinition' && ad.version === version);
  console.log(`  created ActivityDefinition/${created?.id ?? '?'}; retired ${active.length}`);
}

async function main(): Promise<void> {
  const { oystehr } = await createOystehrFromEnvFile(`packages/zambdas/.env/${ENV}.json`);
  await ensureInHouseTest(oystehr, TCB_POC);
  if (!EXECUTE) console.log('(dry run — pass --execute to write)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
