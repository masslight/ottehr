import { CandidApi, CandidApiClient } from 'candidhealth';
import { InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Account, Appointment, Encounter, Patient, RelatedPerson, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FHIR_EXTENSION,
  getFullName,
  getResponsiblePartyFromAccount,
  InvoiceablePatientReport,
  InvoiceablePatientReportFail,
} from 'utils';

export interface InvoiceableClaim {
  claimId: string;
  encounterId: string;
  patientExternalId: string;
  patientArStatus: string;
  timestamp: string;
}

export type ItemizationToClaimIdMap = Record<string, InvoiceItemizationResponse>;

type PatientRelationshipToInsured = 'Self' | 'Spouse' | 'Parent' | 'Legal Guardian' | 'Other';

export async function getCandidItemizationMap(
  candid: CandidApiClient,
  claims: InvoiceableClaim[]
): Promise<ItemizationToClaimIdMap> {
  const itemizationPromises = claims.map((claim) => candid.patientAr.v1.itemize(CandidApi.ClaimId(claim.claimId)));
  const itemizationResponse = await Promise.all(itemizationPromises);

  const itemizationToClaimIdMap: ItemizationToClaimIdMap = {};
  itemizationResponse.forEach((res) => {
    if (res && res.ok && res.body) {
      const itemization = res.body as InvoiceItemizationResponse;
      if (itemization.claimId) itemizationToClaimIdMap[itemization.claimId] = itemization;
    }
  });
  return itemizationToClaimIdMap;
}

export function mapResourcesToInvoiceablePatient(input: {
  itemizationMap: ItemizationToClaimIdMap;
  claim: InvoiceableClaim;
  patientToIdMap: Record<string, Patient>;
  accountsToPatientIdMap: Record<string, Account>;
  appointmentToIdMap: Record<string, Appointment>;
  encounterToCandidIdMap: Record<string, Encounter>;
  allFhirResources: Resource[];
}): InvoiceablePatientReport | InvoiceablePatientReportFail | undefined {
  const {
    itemizationMap,
    claim,
    patientToIdMap,
    accountsToPatientIdMap,
    encounterToCandidIdMap,
    appointmentToIdMap,
    allFhirResources,
  } = input;
  const patient = patientToIdMap[claim.patientExternalId];
  if (patient?.id === undefined) return logErrorForClaimAndReturn('Patient', claim);
  const account = accountsToPatientIdMap[claim.patientExternalId];
  const responsibleParty = getResponsiblePartyFromAccount(account, allFhirResources);
  if (!responsibleParty) return logErrorForClaimAndReturn('RelatedPerson', claim);

  const encounter = encounterToCandidIdMap[claim.encounterId];
  if (!encounter) return logErrorForClaimAndReturn('Encounter', claim);
  const appointmentId = encounter.appointment?.[0]?.reference?.split('/')[1];
  const appointment = appointmentId ? appointmentToIdMap[appointmentId] : undefined;
  if (!appointment) return logErrorForClaimAndReturn('Appointment', claim);
  const appointmentStart = appointment.start;

  const patientBalance = itemizationMap[claim.claimId].patientBalanceCents;
  return {
    id: claim.patientExternalId,
    claimId: claim.claimId,
    name: getFullName(patient),
    dob: patient.birthDate || '--',
    appointmentDate: appointmentStart ? isoToFormat(appointmentStart) : '--',
    finalizationDate: isoToFormat(claim.timestamp),
    responsiblePartyName: responsibleParty ? getFullName(responsibleParty) ?? '--' : '--',
    responsiblePartyRelationshipToPatient: getResponsiblePartyRelationship(responsibleParty) ?? '--',
    amountInvoiceable: `${patientBalance / 100}`, // converting from cents to USD
  };
}

function logErrorForClaimAndReturn(resourceType: string, claim: InvoiceableClaim): InvoiceablePatientReportFail {
  const errorMessage = `${resourceType} resource not found for this claim.`;
  console.error(`🔴 ${errorMessage}`);
  return {
    claimId: claim.claimId,
    patientId: claim.patientExternalId,
    candidEncounterId: claim.encounterId,
    error: errorMessage,
  };
}

function getResponsiblePartyRelationship(
  responsibleParty: RelatedPerson | Patient
): PatientRelationshipToInsured | undefined {
  let result: PatientRelationshipToInsured | undefined = undefined;
  if (responsibleParty.resourceType === 'Patient') return 'Self';
  responsibleParty.relationship?.find(
    (rel) =>
      rel.coding?.find((coding) => {
        if (coding.system === FHIR_EXTENSION.RelatedPerson.responsiblePartyRelationship.url) {
          result = coding.code as PatientRelationshipToInsured;
          return true;
        }
        return false;
      })
  );
  return result;
}

function isoToFormat(isoDate: string, format: string = 'MM-dd-yyyy HH:mm:ss'): string {
  return DateTime.fromISO(isoDate).toFormat(format);
}
