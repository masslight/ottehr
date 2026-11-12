// Moves synth's flowsheet practice forms to the Clinical Forms placement (meta.tag form-placement|questionnaires), so
// their responses show on the chart's Clinical Forms page and the forms appear in its Add Form picker. Every version
// of each form is retagged, the way the admin form editor moves a form when its placement changes. Responses are
// not touched: they already carry the practitioner-distribution tag the page looks for.
//
//   npx tsx scripts/flowsheets/set-form-placement.ts --env synth [--execute]
//
// Without --execute it is a dry run that prints the plan. Re-running makes no further changes.

import { BatchInputPatchRequest } from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { getFormPlacement } from 'utils/lib/helpers/practice-managed-questionnaires';
import { placementTagOperations } from '../../packages/zambdas/src/ehr/practice-managed-questionnaire/helpers';
import { arg, flag } from '../synthetic-patient-data/shared/cli';
import { createOystehrFromEnvFile, searchAllPages } from '../synthetic-patient-data/shared/oystehr-client';

const ENV = arg('--env', 'synth');
const EXECUTE = flag('--execute');
// Seeds demo data only: refuse every other env before authenticating (as synth-daily-census does).
const ALLOWED_ENVS = ['synth', 'local'];
if (!ALLOWED_ENVS.includes(ENV)) {
  throw new Error(`Refusing to run against env "${ENV}": this script only writes to ${ALLOWED_ENVS.join(' or ')}.`);
}

const PLACEMENT = 'questionnaires';
const FORM_URLS = [
  'act-asthma-control-test',
  'phq-9-patient-health-questionnaire-9',
  'phq-a-patient-health-questionnaire-adolescent',
  'gad-7-generalized-anxiety-disorder-7',
  'epds-edinburgh-postnatal-depression-scale',
  'scared-child-screen-for-child-anxiety-related-disorders',
  'scared-parent-screen-for-child-anxiety-related-disorders',
  'vanderbilt-adhd-parent-rating-scale',
  'nichq-vanderbilt-assessment-scale-parent-informant',
  'nichq-vanderbilt-assessment-scale-teacher-informant',
  'nichq-vanderbilt-assessment-follow-up-parent-informant',
  'diabetic-foot-exam',
  'eye-exam-record',
  'home-glucose-review',
  'home-bp-review',
  'ascvd-risk-estimator-10-year-cardiovascular-risk',
  'warfarin-management',
].map((slug) => `https://ottehr.com/FHIR/Questionnaire/${slug}`);

async function main(): Promise<void> {
  const { oystehr } = await createOystehrFromEnvFile(`packages/zambdas/.env/${ENV}.json`);
  const versions = (
    await searchAllPages<Questionnaire>(oystehr, 'Questionnaire', [{ name: 'url', value: FORM_URLS.join(',') }])
  ).filter((q) => FORM_URLS.includes(q.url ?? ''));
  const missing = FORM_URLS.filter((url) => !versions.some((q) => q.url === url));
  if (missing.length) throw new Error(`no Questionnaire found for: ${missing.join(', ')}`);

  const operations = placementTagOperations(versions, PLACEMENT);
  for (const q of versions) {
    const action = operations.has(q.id!) ? `${getFormPlacement(q)} -> ${PLACEMENT}` : `already ${PLACEMENT}`;
    console.log(`Questionnaire/${q.id}  ${q.status}  ${q.version}  "${q.title}"  ${action}`);
  }
  console.log(`${EXECUTE ? 'retagging' : 'would retag'} ${operations.size} of ${versions.length} version(s)`);
  if (!EXECUTE || operations.size === 0) return;

  const requests: BatchInputPatchRequest<Questionnaire>[] = [...operations].map(([id, ops]) => ({
    method: 'PATCH',
    url: `Questionnaire/${id}`,
    operations: ops,
  }));
  for (let attempt = 1; ; attempt++) {
    try {
      await oystehr.fhir.transaction<Questionnaire>({ requests });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`transaction attempt ${attempt} failed, retrying`, error);
    }
  }

  const after = await searchAllPages<Questionnaire>(oystehr, 'Questionnaire', [
    { name: 'url', value: FORM_URLS.join(',') },
  ]);
  const wrong = after.filter((q) => FORM_URLS.includes(q.url ?? '') && getFormPlacement(q) !== PLACEMENT);
  if (wrong.length) throw new Error(`still not ${PLACEMENT}: ${wrong.map((q) => q.id).join(', ')}`);
  console.log(`verified ${after.length} version(s) now placed on ${PLACEMENT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
