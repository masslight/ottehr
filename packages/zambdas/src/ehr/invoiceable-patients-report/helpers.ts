import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Account, Appointment, Encounter, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FHIR_EXTENSION,
  getFullName,
  getResponsiblePartyReferenceFromAccount,
  InvoiceablePatientReport,
  InvoiceablePatientReportFail,
  takeContainedOrFind,
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
}): InvoiceablePatientReport | InvoiceablePatientReportFail | undefined {
  const { itemizationMap, claim, patientToIdMap, accountsToPatientIdMap, encounterToCandidIdMap, appointmentToIdMap } =
    input;
  const patient = patientToIdMap[claim.patientExternalId];
  if (patient?.id === undefined) return logErrorForClaimAndReturn('Patient', claim);
  const account = accountsToPatientIdMap[claim.patientExternalId];
  const responsiblePartyRef = getResponsiblePartyReferenceFromAccount(account);
  if (!responsiblePartyRef) return logErrorForClaimAndReturn('RelatedPerson reference', claim);
  const responsibleParty = takeContainedOrFind(responsiblePartyRef, [], account) as RelatedPerson | undefined;
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

function getResponsiblePartyRelationship(responsibleParty: RelatedPerson): PatientRelationshipToInsured | undefined {
  let result: PatientRelationshipToInsured | undefined = undefined;
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

interface getCandidPagesRecursiveParams {
  candid: CandidApiClient;
  pageToken?: string;
  claims: InventoryRecord[];
  pageCount: number;
  onlyInvoiceable?: boolean;
  limitPerPage?: number;
  maxPages?: number;
}

export async function getCandidPagesRecursive(
  input: getCandidPagesRecursiveParams
): Promise<{ claims: InventoryRecord[]; pageCount: number } | undefined> {
  const { candid, pageToken, limitPerPage, claims, pageCount, onlyInvoiceable, maxPages } = input;
  if (limitPerPage && limitPerPage > 100)
    throw new Error('Limit per page cannot be greater than 100 according to Candid API');

  if (maxPages && pageCount >= maxPages) return { claims, pageCount };

  console.log(`📄 Fetching page ${pageCount}`);
  const inventoryResponse = await candid.patientAr.v1.listInventory({
    limit: limitPerPage,
    pageToken: pageToken ? CandidApi.PageToken(pageToken) : undefined,
  });

  if (inventoryResponse && inventoryResponse.ok && inventoryResponse.body) {
    let records = inventoryResponse.body.records as InventoryRecord[];
    const nextPageToken = inventoryResponse.body.nextPageToken;

    if (onlyInvoiceable) records = records.filter((record) => record.patientArStatus === 'invoiceable');

    console.log(`📄 Page ${pageCount}: Found ${records.length} total claims`);

    if (nextPageToken)
      return await getCandidPagesRecursive({
        ...input,
        claims: claims.concat(records),
        pageToken: nextPageToken,
        pageCount: pageCount + 1,
      });
    else return { claims: claims.concat(records), pageCount: pageCount };
  } else {
    console.log('⚠️ Unexpected response format or failed request on page', pageCount);
    console.log('Response details:', JSON.stringify(inventoryResponse));
  }
  return {
    claims,
    pageCount,
  };
}

function isoToFormat(isoDate: string, format: string = 'MM-dd-yyyy HH:mm:ss'): string {
  return DateTime.fromISO(isoDate).toFormat(format);
}
