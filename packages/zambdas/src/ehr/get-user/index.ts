import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Practitioner, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { GetUserResponse } from 'utils/lib/types/api/get-user.types';
import { PractitionerLicense } from 'utils/lib/types/api/practitioner.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isFhirNotFoundError } from '../../shared/errors';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
const ZAMBDA_NAME = 'get-user';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { secrets, userId } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  let response: GetUserResponse | null = null;
  try {
    const getUserResponse = await oystehr.user.get({ id: userId });
    let existingPractitionerResource: Practitioner | undefined = undefined;
    let schedule: Schedule | undefined;
    let seenPatientRecently = false;
    const userProfile = getUserResponse.profile;
    const userProfileString = userProfile.split('/');

    const practitionerId = userProfileString[1];
    try {
      const [practitionerResource, scheduleSearch] = await Promise.all([
        oystehr.fhir.get<Practitioner>({
          resourceType: 'Practitioner',
          id: practitionerId,
        }),
        oystehr.fhir
          .search<Schedule>({
            resourceType: 'Schedule',
            params: [
              {
                name: 'actor',
                value: `Practitioner/${practitionerId}`,
              },
            ],
          })
          .then((bundle) => {
            const resources = bundle.unbundle();
            const schedule = resources.find((r) => r.resourceType === 'Schedule');
            return schedule;
          }),
      ]);
      existingPractitionerResource = practitionerResource;
      schedule = scheduleSearch;
      console.log('Existing practitioner: ' + JSON.stringify(existingPractitionerResource));
    } catch (error: any) {
      // A user still on a Patient profile (signed up, never set up as an employee) has no
      // Practitioner to fetch. That's expected here: the record page renders an empty form so the
      // user can be given a name and a role, at which point `update-user` creates the Practitioner.
      if (isFhirNotFoundError(error)) {
        existingPractitionerResource = undefined;
      } else {
        throw error;
      }
    }
    // Only meaningful once the user actually has a Practitioner — a self-registered account still on
    // a Patient profile has no encounters to have participated in, and querying as though it did
    // means searching for `Practitioner/<patient-id>`.
    seenPatientRecently = existingPractitionerResource?.id
      ? await hasRecentEncounter(oystehr, existingPractitionerResource.id)
      : false;

    const allLicenses: Array<PractitionerLicense> = [];
    console.log(existingPractitionerResource);
    if (existingPractitionerResource?.qualification) {
      existingPractitionerResource?.qualification.forEach((qualification: any) => {
        const newLicense: PractitionerLicense = {
          state: qualification.extension[0].extension[1].valueCodeableConcept.coding[0].code,
          code: qualification.code.coding[0].code,
          active: qualification.extension[0].extension[0].valueCode === 'active',
        };
        allLicenses.push(newLicense);
      });
    }

    response = {
      message: `Successfully got user ${userId}`,
      user: {
        ...getUserResponse,
        profileResource: existingPractitionerResource,
        licenses: allLicenses ?? [],
      },
      userScheduleId: schedule?.id,
      seenPatientRecently,
    };
  } catch (error: unknown) {
    // Rethrow as-is. Wrapping in `new Error(JSON.stringify(error))` reported every failure as
    // `Failed to get User: {}` — `message` and `stack` are non-enumerable, so stringifying an Error
    // discards exactly the detail needed to diagnose it.
    console.error(`Failed to get user ${userId}:`, error);
    throw error;
  }

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

/**
 * Whether this practitioner took part in an encounter in the last 30 minutes — the "been seen last 30
 * mins" indicator on the employee record.
 *
 * Deliberately fail-soft, and deliberately isolated from the fetches this endpoint actually needs.
 * The flag drives a single chip; a search failure should cost us the chip, not the whole record. It
 * also uses Encounter search params (`participant`, `date`) that nothing else in this codebase
 * relies on — `get-employees` sweeps by status and filters participants in application code — so if
 * this index doesn't support them, this returns false and logs rather than failing the request.
 */
const hasRecentEncounter = async (oystehr: Oystehr, practitionerId: string): Promise<boolean> => {
  const cutoff = DateTime.now().minus({ minutes: 30 }).toFormat("yyyy-MM-dd'T'HH:mm");
  try {
    const bundle = await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        { name: 'participant', value: `Practitioner/${practitionerId}` },
        { name: 'status', value: 'in-progress,finished' },
        { name: 'date', value: `gt${cutoff}` },
        { name: '_elements', value: 'id' },
        { name: '_count', value: '1' },
      ],
    });
    return bundle.unbundle().length > 0;
  } catch (error) {
    console.error(`Could not determine recent encounter activity for Practitioner/${practitionerId}:`, error);
    return false;
  }
};
