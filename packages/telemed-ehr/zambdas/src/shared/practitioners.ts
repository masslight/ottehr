import { AppClient, FhirClient, User } from '@zapehr/sdk';
import { Practitioner, PractitionerQualification, Resource } from 'fhir/r4';
import {
  PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
  PRACTITIONER_QUALIFICATION_EXTENSION_URL,
  PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
  PractitionerLicense,
} from 'ehr-utils';

export async function getPractitionerResourceForUser(
  userId: User['id'],
  fhirClient: FhirClient,
  appClient: AppClient,
): Promise<Practitioner> {
  const user = await appClient.getUser(userId);
  if (!user) {
    throw new Error(`Can't find user with provided ID: ${userId}`);
  }
  try {
    const practitionerResource: Resource = await fhirClient.readResource({
      resourceType: 'Practitioner',
      resourceId: user.profile.replace('Practitioner/', ''),
    });

    return practitionerResource as Practitioner;
  } catch (error) {
    throw new Error(`Error occured while trying to get Practitioner resource for user ${userId}`);
  }
}

export async function getMyPractitionerId(fhirClient: FhirClient, appClient: AppClient): Promise<string> {
  const myUserId = (await appClient.getMe()).id;
  const myPractId = (await getPractitionerResourceForUser(myUserId, fhirClient, appClient)).id;
  if (myPractId) return myPractId;
  throw new Error("Can't receive practitioner resource id attached to current user");
}

export function makeQualificationForPractitioner(license: PractitionerLicense): PractitionerQualification {
  return {
    code: {
      coding: [
        {
          system: PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
          code: license.code,
          //display: PractitionerQualificationCodesLabels[license.code],
        },
      ],
      text: 'Qualification code',
    },
    extension: [
      {
        url: PRACTITIONER_QUALIFICATION_EXTENSION_URL,
        extension: [
          {
            url: 'status',
            valueCode: 'active',
          },
          {
            url: 'whereValid',
            valueCodeableConcept: {
              coding: [
                {
                  code: license.state,
                  system: PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
