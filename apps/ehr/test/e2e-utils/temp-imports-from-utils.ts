import { Patient, Person, Practitioner, PractitionerQualification, RelatedPerson } from 'fhir/r4b';

/**
 * THIS IS TEMPORARY SOLUTION!!!
 * Here i've copied all helpers from utils and other packages
 * because we can't directly import them in app for now
 * todo remove this file when we have ability to direct import from 'utils'
 * */

export const PRACTITIONER_QUALIFICATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7';
export const PRACTITIONER_QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';
export const PRACTITIONER_QUALIFICATION_STATE_SYSTEM = 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state';

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
