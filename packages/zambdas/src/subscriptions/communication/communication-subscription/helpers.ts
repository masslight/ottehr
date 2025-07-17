import Oystehr from '@oystehr/sdk';
import { CodeableConcept, Coding, Group, Location, Practitioner } from 'fhir/r4b';

export interface bundleResourcesConfig {
  location?: Location;
  group?: Group;
  practitioner?: Practitioner;
}

export const codingContainedInList = (coding: Coding, codingList: CodeableConcept[] | undefined): boolean => {
  if (!codingList) return false;
  return codingList.reduce((haveMatch, currentCoding) => {
    return haveMatch || codingsEqual(coding, currentCoding.coding?.[0]);
  }, false);
};

const codingsEqual = (coding1: Coding, coding2: Coding | undefined): boolean => {
  const systemsAreEqual = coding1.system === coding2?.system;
  const codesAreEqual = coding1.code === coding2?.code;

  return systemsAreEqual && codesAreEqual;
};

export const getEmailsFromGroup = async (group: Group | undefined, oystehr: Oystehr): Promise<string[] | undefined> => {
  if (!group) return;
  let practitionersEmails: string[] | undefined;
  if (group.member) {
    const practitionerIds = group.member?.map((member) => member.entity.reference?.replace('Practitioner/', ''));
    const practitioners = (
      await oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [{ name: '_id', value: practitionerIds.join(',') }],
      })
    ).unbundle();

    practitionersEmails = practitioners.reduce((emails: string[], practitioner) => {
      const workTelecom = practitioner?.telecom?.find((telecom) => telecom.use === 'work');
      const workEmail = workTelecom?.value;
      if (workEmail) {
        emails.push(workEmail);
      }
      return emails;
    }, []);
  }
  return practitionersEmails;
};
