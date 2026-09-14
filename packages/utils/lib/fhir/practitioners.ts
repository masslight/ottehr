import { Encounter, Extension, Practitioner, PractitionerQualification } from 'fhir/r4b';
import { PractitionerLicense, ProviderTypeCode } from '../types/api/practitioner.types';
import { PHRASES_EXTENSION_URL } from '../types/constants';
import { PRACTITIONER_CODINGS } from '../types/data/appointments/appointments.types';
import {
  PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
  PRACTITIONER_QUALIFICATION_EXTENSION_URL,
  PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
  PROVIDER_TYPE_EXTENSION_URL,
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

export function makeProviderTypeExtension(
  providerType?: ProviderTypeCode,
  providerTypeText?: string
): Extension[] | undefined {
  if (!providerType) return undefined;

  return [
    {
      url: PROVIDER_TYPE_EXTENSION_URL,
      valueCodeableConcept: {
        coding: [
          {
            system: 'provider-type',
            code: providerType,
            display: providerType,
          },
        ],
        text: providerTypeText || providerType,
      },
    },
  ];
}

export function getSuffixFromProviderTypeExtension(providerTypeExtension?: Extension[]): string[] | undefined {
  if (!providerTypeExtension || providerTypeExtension.length === 0) return undefined;

  const ext = providerTypeExtension.find((e) => e.url === PROVIDER_TYPE_EXTENSION_URL);
  if (!ext?.valueCodeableConcept) return undefined;

  const cc = ext.valueCodeableConcept;
  return [cc.text || cc.coding?.[0]?.display || cc.coding?.[0]?.code].filter(Boolean) as string[];
}

export interface Phrase {
  key: string;
  value: string;
}

/** Reads the per-user phrases stored on the Practitioner; missing or malformed extension → []. */
export const getPhrasesForPractitioner = (practitioner?: Practitioner): Phrase[] => {
  const raw = practitioner?.extension?.find((extension) => extension.url === PHRASES_EXTENSION_URL)?.valueString;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (phrase): phrase is Phrase =>
            typeof phrase?.key === 'string' && typeof phrase?.value === 'string' && phrase.key.length > 0
        )
      : [];
  } catch (error) {
    console.error('Failed to parse practitioner phrases', error);
    return [];
  }
};
