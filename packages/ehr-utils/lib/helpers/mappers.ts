import { FhirClient } from '@zapehr/sdk';
import { Communication, RelatedPerson, Resource } from 'fhir/r4';
import { removePrefix } from '.';
import {
  filterResources,
  getCommunicationsAndSenders,
  getSMSNumberForIndividual,
  getUniquePhonesNumbers,
} from '../fhir';
import { RelatedPersonMaps } from '../types';

export const relatedPersonAndCommunicationMaps = async (
  fhirClient: FhirClient,
  inputResources: Resource[],
): Promise<RelatedPersonMaps> => {
  const allRelatedPersons = filterResources(inputResources, 'RelatedPerson') as RelatedPerson[];
  const rpsPhoneNumbers = getUniquePhonesNumbers(allRelatedPersons);
  const rpsToPatientIdMap = mapRelatedPersonToPatientId(allRelatedPersons);
  const rpToIdMap = mapRelatedPersonToId(allRelatedPersons);
  const foundResources = await getCommunicationsAndSenders(fhirClient, rpsPhoneNumbers);
  const foundRelatedPersons = filterResources(foundResources, 'RelatedPerson') as RelatedPerson[];
  Object.assign(rpToIdMap, mapRelatedPersonToId(foundRelatedPersons));
  rpsPhoneNumbers.concat(getUniquePhonesNumbers(foundRelatedPersons)); // do better here
  const rpsRefsToPhoneNumberMap = mapRelatedPersonsRefsToPhoneNumber(foundRelatedPersons);

  const foundCommunications = filterResources(foundResources, 'Communication') as Communication[];
  const commsToRpRefMap = mapCommunicationsToRelatedPersonRef(foundCommunications, rpToIdMap, rpsRefsToPhoneNumberMap);

  return {
    rpsToPatientIdMap,
    commsToRpRefMap,
  };
};

function mapRelatedPersonToPatientId(allRps: RelatedPerson[]): Record<string, RelatedPerson[]> {
  const rpsToPatientIdMap: Record<string, RelatedPerson[]> = {};

  allRps.forEach((rp) => {
    const patientId = removePrefix('Patient/', rp.patient.reference || '');
    if (patientId) {
      if (rpsToPatientIdMap[patientId]) rpsToPatientIdMap[patientId].push(rp);
      else rpsToPatientIdMap[patientId] = [rp];
    }
  });

  return rpsToPatientIdMap;
}

function mapRelatedPersonToId(allRps: RelatedPerson[]): Record<string, RelatedPerson> {
  const rpToIdMap: Record<string, RelatedPerson> = {};

  allRps.forEach((rp) => {
    rpToIdMap['RelatedPerson/' + rp.id] = rp;
  });

  return rpToIdMap;
}

function mapRelatedPersonsRefsToPhoneNumber(allRps: RelatedPerson[]): Record<string, string[]> {
  const relatedPersonRefToPhoneNumber: Record<string, string[]> = {};

  allRps.forEach((rp) => {
    const rpRef = `RelatedPerson/${rp.id}`;
    const pn = getSMSNumberForIndividual(rp as RelatedPerson);
    if (pn) {
      if (relatedPersonRefToPhoneNumber[pn]) relatedPersonRefToPhoneNumber[pn].push(rpRef);
      else relatedPersonRefToPhoneNumber[pn] = [rpRef];
    }
  });
  return relatedPersonRefToPhoneNumber;
}

function mapCommunicationsToRelatedPersonRef(
  allCommunications: Communication[],
  rpToIdMap: Record<string, RelatedPerson>,
  rpsRefsToPhoneNumberMap: Record<string, string[]>,
): Record<string, Communication[]> {
  const commsToRpRefMap: Record<string, Communication[]> = {};

  allCommunications.forEach((comm) => {
    const communication = comm as Communication;
    const rpRef = communication.sender?.reference;
    if (rpRef) {
      const senderResource = rpToIdMap[rpRef];
      if (senderResource) {
        const smsNumber = getSMSNumberForIndividual(senderResource);
        if (smsNumber) {
          const allRPsWithThisNumber = rpsRefsToPhoneNumberMap[smsNumber];
          allRPsWithThisNumber.forEach((rpRef) => {
            if (commsToRpRefMap[rpRef]) commsToRpRefMap[rpRef].push(communication);
            else commsToRpRefMap[rpRef] = [communication];
          });
        }
      }
    }
  });

  return commsToRpRefMap;
}
