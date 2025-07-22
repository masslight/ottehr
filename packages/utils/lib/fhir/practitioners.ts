import { Encounter, Extension, PractitionerQualification } from 'fhir/r4b';
import { PRACTITIONER_CODINGS, PractitionerLicense } from '../types';
import {
  PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
  PRACTITIONER_QUALIFICATION_EXTENSION_URL,
  PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
} from './constants';

export function makeQualificationForPractitioner(license: PractitionerLicense): PractitionerQualification {
  const number = license.number
    ? {
        url: 'number',
        valueString: license.number,
      }
    : undefined;
  const date = license.date
    ? {
        url: 'expDate',
        valueDate: license.date,
      }
    : undefined;
  const extraExtensions = [number, date].filter(Boolean) as Extension[];

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
          ...extraExtensions,
        ],
      },
    ],
  };
}

export function getAttendingPractitionerId(encounter: Encounter): string | undefined {
  const practitionerId = encounter.participant
    ?.find(
      (participant) =>
        participant.type?.find(
          (type) =>
            type.coding?.some(
              (c) =>
                c.system === PRACTITIONER_CODINGS.Attender[0].system && c.code === PRACTITIONER_CODINGS.Attender[0].code
            )
        )
    )
    ?.individual?.reference?.replace('Practitioner/', '');

  return practitionerId;
}

export function getAdmitterPractitionerId(encounter: Encounter): string | undefined {
  const practitionerId = encounter.participant
    ?.find(
      (participant) =>
        participant.type?.find(
          (type) =>
            type.coding?.some(
              (c) =>
                c.system === PRACTITIONER_CODINGS.Admitter[0].system && c.code === PRACTITIONER_CODINGS.Admitter[0].code
            )
        )
    )
    ?.individual?.reference?.replace('Practitioner/', '');

  return practitionerId;
}
