import { Patient, Person, Practitioner, PractitionerQualification, RelatedPerson, Location } from 'fhir/r4b';

/**
 * THIS IS TEMPORARY SOLUTION!!!
 * Here i've copied all helpers from utils and other packages
 * because we can't directly import them in app for now
 * todo remove this file when we have ability to direct import from 'utils'
 * */

import Oystehr from '@oystehr/sdk';

export enum TelemedAppointmentStatusEnum {
  'ready' = 'ready',
  'pre-video' = 'pre-video',
  'on-video' = 'on-video',
  'unsigned' = 'unsigned',
  'complete' = 'complete',
  'cancelled' = 'cancelled',
}

export const PRACTITIONER_QUALIFICATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7';
export const PRACTITIONER_QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';
export const PRACTITIONER_QUALIFICATION_STATE_SYSTEM = 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state';
export const PUBLIC_EXTENSION_BASE_URL = 'https://extensions.fhir.zapehr.com';

export interface PractitionerLicense {
  state: string;
  code: string;
  active: boolean;
}

export function allLicensesForPractitioner(practitioner: Practitioner): PractitionerLicense[] {
  const allLicenses: PractitionerLicense[] = [];
  if (practitioner?.qualification) {
    practitioner.qualification.forEach((qualification) => {
      const qualificationExt = qualification.extension?.find(
        (ext) => ext.url === PRACTITIONER_QUALIFICATION_EXTENSION_URL
      );

      if (qualificationExt) {
        const qualificationCode = qualification.code.coding?.find(
          (code) => code.system === PRACTITIONER_QUALIFICATION_CODE_SYSTEM
        )?.code;

        const stateExtension = qualificationExt.extension?.find((ext) => ext.url === 'whereValid');
        const qualificationState = stateExtension?.valueCodeableConcept?.coding?.find(
          (coding) => coding.system === PRACTITIONER_QUALIFICATION_STATE_SYSTEM
        )?.code;

        const statusExtension = qualificationExt.extension?.find((ext) => ext.url === 'status')?.valueCode;

        if (qualificationCode && qualificationState)
          allLicenses.push({
            state: qualificationState,
            code: qualificationCode,
            active: statusExtension === 'active',
          });
      }
    });
  }

  return allLicenses;
}

export function getFirstName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.given?.[0];
}

export function getMiddleName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0].given?.[1];
}

export function getLastName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.family;
}

export function getSuffix(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.suffix?.[0];
}

export function getPractitionerNPI(practitioner: Practitioner): string | undefined {
  return practitioner.identifier?.find((ident) => {
    // correct uri http://hl7.org/fhir/sid/us-npi
    // will need to clean up in prod before removing search for the incorrect one
    return ident.system === 'http://hl7.org/fhir/sid/us-npi' || ident.system === 'http://hl7.org.fhir/sid/us-npi';
  })?.value;
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

export interface PractitionerLicense {
  state: string;
  code: string;
  active: boolean;
}

export enum RoleType {
  NewUser = 'NewUser',
  Administrator = 'Administrator',
  AssistantAdmin = 'AssistantAdmin',
  RegionalTelemedLead = 'RegionalTelemedLead',
  CallCentre = 'CallCentre',
  Billing = 'Billing',
  Manager = 'Manager',
  Staff = 'Staff',
  Provider = 'Provider',
  FrontDesk = 'Front Desk',
  Inactive = 'Inactive',
  // Medical Assystant
}

export const AVAILABLE_EMPLOYEE_ROLES: {
  value: RoleType;
  label: string;
  hint: string;
}[] = [
  {
    value: RoleType.Administrator,
    label: 'Administrator',
    hint: `Adjust full settings for entire system`,
  },
  {
    value: RoleType.Manager,
    label: 'Manager',
    hint: `Adjust operating hours or schedule overrides; adjust pre-booked visits per hour`,
  },
  {
    value: RoleType.Staff,
    label: 'Staff',
    hint: `No settings changes; essentially read-only`,
  },
  {
    value: RoleType.Provider,
    label: 'Provider',
    hint: `A clinician, such as a doctor, a PA or an NP`,
  },
  // {
  //   value: RoleType.Prescriber,
  //   label: 'Prescriber',
  //   hint: `A clinician that is allowed to prescribe`,
  // },
];

export async function getTelemedLocation(oystehr: Oystehr, state: string): Promise<Location | undefined> {
  const resources = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'address-state',
          value: state,
        },
      ],
    })
  ).unbundle();

  return resources.find((location) => isLocationVirtual(location));
}

export enum AdditionalBooleanQuestionsFieldsNames {
  TestedPositiveCovid = 'tested-positive-covid',
  TravelUsa = 'travel-usa',
  CovidSymptoms = 'covid-symptoms',
}

export interface AdditionalBooleanQuestion {
  label: string;
  field: AdditionalBooleanQuestionsFieldsNames;
}

export const ADDITIONAL_QUESTIONS: AdditionalBooleanQuestion[] = [
  {
    label: 'Do you have any COVID symptoms?',
    field: AdditionalBooleanQuestionsFieldsNames.CovidSymptoms,
  },
  {
    label: 'Have you tested positive for COVID?',
    field: AdditionalBooleanQuestionsFieldsNames.TestedPositiveCovid,
  },
  {
    label: 'Have you traveled out of the USA in the last 2 weeks?',
    field: AdditionalBooleanQuestionsFieldsNames.TravelUsa,
  },
];

export const isLocationVirtual = (location: Location): boolean => {
  return Boolean(
    location.extension?.find((ext) => ext.url === `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`)?.valueCoding
      ?.code === 'vi'
  );
};

export const AllStates: ValuePair[] = [
  { value: 'AL', label: 'AL' }, // Alabama
  { value: 'AK', label: 'AK' }, // Alaska
  { value: 'AZ', label: 'AZ' }, // Arizona
  { value: 'AR', label: 'AR' }, // Arkansas
  { value: 'CA', label: 'CA' }, // California
  { value: 'CO', label: 'CO' }, // Colorado
  { value: 'CT', label: 'CT' }, // Connecticut
  { value: 'DE', label: 'DE' }, // Delaware
  { value: 'DC', label: 'DC' },
  { value: 'FL', label: 'FL' }, // Florida
  { value: 'GA', label: 'GA' }, // Georgia
  { value: 'HI', label: 'HI' }, // Hawaii
  { value: 'ID', label: 'ID' }, // Idaho
  { value: 'IL', label: 'IL' }, // Illinois
  { value: 'IN', label: 'IN' }, // Indiana
  { value: 'IA', label: 'IA' }, // Iowa
  { value: 'KS', label: 'KS' }, // Kansas
  { value: 'KY', label: 'KY' }, // Kentucky
  { value: 'LA', label: 'LA' }, // Louisiana
  { value: 'ME', label: 'ME' }, // Maine
  { value: 'MD', label: 'MD' }, // Maryland
  { value: 'MA', label: 'MA' }, // Massachusetts
  { value: 'MI', label: 'MI' }, // Michigan
  { value: 'MN', label: 'MN' }, // Minnesota
  { value: 'MS', label: 'MS' }, // Mississippi
  { value: 'MO', label: 'MO' }, // Missouri
  { value: 'MT', label: 'MT' }, // Montana
  { value: 'NE', label: 'NE' }, // Nebraska
  { value: 'NV', label: 'NV' }, // Nevada
  { value: 'NH', label: 'NH' }, // New Hampshire
  { value: 'NJ', label: 'NJ' }, // New Jersey
  { value: 'NM', label: 'NM' }, // New Mexico
  { value: 'NY', label: 'NY' }, // New York
  { value: 'NC', label: 'NC' }, // North Carolina
  { value: 'ND', label: 'ND' }, // North Dakota
  { value: 'OH', label: 'OH' }, // Ohio
  { value: 'OK', label: 'OK' }, // Oklahoma
  { value: 'OR', label: 'OR' }, // Oregon
  { value: 'PA', label: 'PA' }, // Pennsylvania
  { value: 'RI', label: 'RI' }, // Rhode Island
  { value: 'SC', label: 'SC' }, // South Carolina
  { value: 'SD', label: 'SD' }, // South Dakota
  { value: 'TN', label: 'TN' }, // Tennessee
  { value: 'TX', label: 'TX' }, // Texas
  { value: 'UT', label: 'UT' }, // Utah
  { value: 'VT', label: 'VT' }, // Vermont
  { value: 'VA', label: 'VA' }, // Virginia
  { value: 'VI', label: 'VI' },
  { value: 'WA', label: 'WA' }, // Washington
  { value: 'WV', label: 'WV' }, // West Virginia
  { value: 'WI', label: 'WI' }, // Wisconsin
  { value: 'WY', label: 'WY' }, // Wyoming
];

export type StateCode = (typeof AllStates)[number]['value'];

export const stateCodeToFullName: Readonly<Record<StateCode, string>> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VI: 'Virgin Islands',
  VT: 'Vermont',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export interface ValuePair {
  value: string;
  label: string;
}

export enum AppointmentVisitTabs {
  'hpi' = 'hpi',
  'exam' = 'exam',
  'erx' = 'erx',
  'plan' = 'plan',
  'sign' = 'sign',
}

export enum ApptTab {
  'ready' = 'ready',
  'provider' = 'provider',
  'not-signed' = 'not-signed',
  'complete' = 'complete',
}
