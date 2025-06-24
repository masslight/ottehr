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
  let pracitionersEmails: string[] | undefined;
  if (group.member) {
    const pracitionerIds = group.member?.map((member) => member.entity.reference?.replace('Practitioner/', ''));
    const pracitioners = (
      await oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [{ name: '_id', value: pracitionerIds.join(',') }],
      })
    ).unbundle();

    pracitionersEmails = pracitioners.reduce((emails: string[], pracitioner) => {
      const workTelecom = pracitioner?.telecom?.find((telecom) => telecom.use === 'work');
      const workEmail = workTelecom?.value;
      if (workEmail) {
        emails.push(workEmail);
      }
      return emails;
    }, []);
  }
  return pracitionersEmails;
};
