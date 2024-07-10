import { Encounter, Practitioner } from 'fhir/r4';
import {
  PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
  PRACTITIONER_QUALIFICATION_EXTENSION_URL,
  PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
  PractitionerLicense,
  PractitionerQualificationCode,
} from '../types';

export function allLicensesForPractitioner(practitioner: Practitioner): PractitionerLicense[] {
  const allLicenses: PractitionerLicense[] = [];
  if (practitioner?.qualification) {
    practitioner.qualification.forEach((qualification) => {
      const qualificationExt = qualification.extension?.find(
        (ext) => ext.url === PRACTITIONER_QUALIFICATION_EXTENSION_URL,
      );

      if (qualificationExt) {
        const qualificationCode = qualification.code.coding?.find(
          (code) => code.system === PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
        )?.code as PractitionerQualificationCode;

        const stateExtension = qualificationExt.extension?.find((ext) => ext.url === 'whereValid');
        const qualificationState = stateExtension?.valueCodeableConcept?.coding?.find(
          (coding) => coding.system === PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
        )?.code;

        const statusExtension = qualificationExt.extension?.find((ext) => ext.url === 'status')?.valueCode;
        console.log('statusExtension', statusExtension);

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

export const removePrefix = (prefix: string, text: string): string | undefined => {
  return text.includes(prefix) ? text.replace(prefix, '') : undefined;
};

export const checkIsEncounterForPractitioner = (encounter: Encounter, practitioner: Practitioner): boolean => {
  const practitionerId = practitioner?.id;

  const encounterPractitioner = encounter.participant?.find((item) =>
    item.individual?.reference?.startsWith('Practitioner/'),
  )?.individual?.reference;
  const encounterPractitionerId = encounterPractitioner && removePrefix('Practitioner/', encounterPractitioner);

  return !!practitioner && !!encounterPractitioner && practitionerId === encounterPractitionerId;
};
