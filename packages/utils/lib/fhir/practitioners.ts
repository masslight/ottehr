import { Operation } from 'fast-json-patch';
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

export const getPhrasesForPractitioner = (practitioner?: Practitioner): Phrase[] => {
  const raw = practitioner?.extension?.find((extension) => extension.url === PHRASES_EXTENSION_URL)?.valueString;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (phrase): phrase is Phrase =>
            typeof phrase?.key === 'string' && typeof phrase?.value === 'string' && phrase.key.trim().length > 0
        )
      : [];
  } catch (error) {
    console.error('Failed to parse practitioner phrases', error);
    return [];
  }
};

export type PhraseChange = { type: 'upsert'; phrase: Phrase; replacesKey?: string } | { type: 'delete'; key: string };

export type PhraseChangeResult = { ok: true; phrases: Phrase[] } | { ok: false; reason: 'missing' | 'duplicate-key' };

export const normalizePhraseKey = (key: string): string => key.trim().toLowerCase();

export const applyPhraseChange = (phrases: Phrase[], change: PhraseChange): PhraseChangeResult => {
  const indexOfKey = (key: string): number => {
    const normalized = normalizePhraseKey(key);
    return phrases.findIndex((phrase) => normalizePhraseKey(phrase.key) === normalized);
  };

  if (change.type === 'delete') {
    const index = indexOfKey(change.key);
    return { ok: true, phrases: index < 0 ? [...phrases] : phrases.filter((_phrase, i) => i !== index) };
  }

  const targetIndex = change.replacesKey === undefined ? indexOfKey(change.phrase.key) : indexOfKey(change.replacesKey);

  if (change.replacesKey === undefined) {
    return {
      ok: true,
      phrases:
        targetIndex < 0
          ? [...phrases, change.phrase]
          : phrases.map((phrase, i) => (i === targetIndex ? change.phrase : phrase)),
    };
  }

  if (targetIndex < 0) {
    return { ok: false, reason: 'missing' };
  }

  const collisionIndex = indexOfKey(change.phrase.key);
  if (collisionIndex >= 0 && collisionIndex !== targetIndex) {
    return { ok: false, reason: 'duplicate-key' };
  }

  return { ok: true, phrases: phrases.map((phrase, i) => (i === targetIndex ? change.phrase : phrase)) };
};

export const getPhrasesPatchOperation = (practitioner: Practitioner, phrases: Phrase[]): Operation => {
  const phrasesExtension: Extension = { url: PHRASES_EXTENSION_URL, valueString: JSON.stringify(phrases) };
  const existingExtensions = practitioner.extension;

  if (!existingExtensions) {
    return { op: 'add', path: '/extension', value: [phrasesExtension] };
  }

  const existingIndex = existingExtensions.findIndex((extension) => extension.url === PHRASES_EXTENSION_URL);

  return {
    op: 'replace',
    path: '/extension',
    value:
      existingIndex < 0
        ? [...existingExtensions, phrasesExtension]
        : existingExtensions.map((extension, index) => (index === existingIndex ? phrasesExtension : extension)),
  };
};
