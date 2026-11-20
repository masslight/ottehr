import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Encounter, Practitioner } from 'fhir/r4b';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import { erxSavedFormIsEmpty, ErxSavedFormResponse } from 'utils/lib/types/api/erx.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { erxSavedFormSearchParams, makeErxSavedFormBasic, parseErxSavedFormBasic } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'erx-saved-form';

// Loads or saves a visit's eRx order form saved for a provider to send (requirements 53a–53f). Every role that works
// in the chart may (ALL_EHR_STAFF_ROLES); Billing Admin may not. A refused role and a missing visit get the same error,
// so the endpoint can't tell a caller whether an encounter exists. The saved form is found by its visit only.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const user = await requireUserWithRole(getUserToken(input), params.secrets, ALL_EHR_STAFF_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  const [encounters, savedForms] = await Promise.all([
    oystehr.fhir
      .search<Encounter>({ resourceType: 'Encounter', params: [{ name: '_id', value: params.encounterId }] })
      .then((bundle) => bundle.unbundle()),
    oystehr.fhir
      .search<Basic>({ resourceType: 'Basic', params: erxSavedFormSearchParams([params.encounterId]) })
      .then((bundle) => bundle.unbundle()),
  ]);
  if (!encounters.some((encounter) => encounter.id === params.encounterId)) throw NOT_AUTHORIZED;

  if (params.action === 'get') {
    const latest = [...savedForms].sort((a, b) => (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? ''));
    const response: ErxSavedFormResponse = { saved: latest[0] ? parseErxSavedFormBasic(latest[0]) : null };
    return { statusCode: 200, body: JSON.stringify(response) };
  }

  // The last save wins: it replaces the saved form, and an empty form removes it.
  const [existing, ...extra] = savedForms;
  let saved: Basic | undefined;
  if (erxSavedFormIsEmpty(params.form)) {
    await Promise.all(savedForms.map((basic) => oystehr.fhir.delete({ resourceType: 'Basic', id: basic.id! })));
  } else {
    const practitionerId = user.profile?.startsWith('Practitioner/')
      ? user.profile.slice('Practitioner/'.length)
      : undefined;
    const practitioner = practitionerId
      ? await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId })
      : undefined;
    const name = practitioner && [getFirstName(practitioner), getLastName(practitioner)].filter(Boolean).join(' ');
    const basic = makeErxSavedFormBasic(params.encounterId, params.form, {
      reference: practitionerId && `Practitioner/${practitionerId}`,
      display: name || undefined,
    });
    saved = existing
      ? await oystehr.fhir.update<Basic>({ ...basic, id: existing.id })
      : await oystehr.fhir.create<Basic>(basic);
    await Promise.all(extra.map((other) => oystehr.fhir.delete({ resourceType: 'Basic', id: other.id! })));
  }
  const response: ErxSavedFormResponse = { saved: saved ? parseErxSavedFormBasic(saved) : null };
  return { statusCode: 200, body: JSON.stringify(response) };
});
