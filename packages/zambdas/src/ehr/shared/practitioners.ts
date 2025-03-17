import Oystehr from '@oystehr/sdk';
import { PractitionerQualification } from 'fhir/r4b';
import {
  PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
  PRACTITIONER_QUALIFICATION_EXTENSION_URL,
  PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
  PractitionerLicense,
  removePrefix,
} from 'utils';

export async function getMyPractitionerId(oystehr: Oystehr): Promise<string> {
  const myPractId = removePrefix('Practitioner/', (await oystehr.user.me()).profile);
  if (!myPractId) throw new Error("Can't receive practitioner resource id attached to current user");
  return myPractId;
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
            valueCode: license.active ? 'active' : 'inactive',
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
