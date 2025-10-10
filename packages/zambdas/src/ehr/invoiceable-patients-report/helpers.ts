import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Account, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createReference,
  FHIR_EXTENSION,
  getFirstName,
  getFullName,
  InvoiceablePatient,
  takeContainedOrFind,
} from 'utils';

export interface InvoiceableClaim {
  claimId: string;
  encounterId: string;
  patientExternalId: string;
  patientArStatus: string;
  timestamp: string;
}

export type ClaimsToPatientIdMap = Record<string, InvoiceItemizationResponse[]>;

type PatientRelationshipToInsured = 'Self' | 'Spouse' | 'Parent' | 'Legal Guardian' | 'Other';

export async function getAllCandidClaims(
  candid: CandidApiClient,
  claims: InvoiceableClaim[]
): Promise<ClaimsToPatientIdMap> {
  const claimsPromises = claims.map(async (claim) => {
    const claimPromise = await candid.patientAr.v1.itemize(CandidApi.ClaimId(claim.claimId));
    return {
      claimPromise,
      patientId: claim.patientExternalId,
    };
  });

  const claimsResponse = await Promise.all(claimsPromises);

  const claimsToPatientMap: Record<string, InvoiceItemizationResponse[]> = {};
  claimsResponse.forEach((res) => {
    const { claimPromise, patientId } = res;
    if (claimPromise && claimPromise.ok && claimPromise.body) {
      const claim = claimPromise.body as InvoiceItemizationResponse;
      if (claimsToPatientMap[patientId] === undefined) claimsToPatientMap[patientId] = [claim];
      else claimsToPatientMap[patientId].push(claim);
    }
  });

  return claimsToPatientMap;
}

export function mapResourcesToInvoiceablePatient(
  patients: Patient[],
  accounts: Account[],
  claimsMap: ClaimsToPatientIdMap,
  claim: InvoiceableClaim
): InvoiceablePatient | undefined {
  const patient = patients.find((patient) => patient.id === claim.patientExternalId);
  if (patient?.id === undefined) {
    console.error('🔴 Patient not found for claim:', claim.claimId);
    return;
  }
  const account = accounts.find(
    (acc) => acc.subject?.find((subj) => (subj.reference = createReference(patient).reference))
  );
  const responsiblePartyRef = account?.guarantor?.find((gRef) => {
    return gRef.period?.end === undefined;
  })?.party?.reference;
  if (!responsiblePartyRef) {
    console.error('🔴 Responsible party reference not found for claim:', claim.claimId);
    return;
  }
  const responsibleParty = takeContainedOrFind(responsiblePartyRef, patients, account) as RelatedPerson | undefined;
  if (!responsibleParty) {
    console.error('🔴 Responsible party RelatedPerson resource not found for claim:', claim.claimId);
    return;
  }

  const patientBalance = claimsMap[patient.id].reduce((acc, claim) => acc + claim.patientBalanceCents, 0);
  return {
    id: claim.patientExternalId,
    name: getFullName(patient),
    dob: patient.birthDate || '--',
    serviceDate: DateTime.fromISO(claim.timestamp).toFormat('yyyy-MM-dd HH:mm:ss'), // is it right??
    responsiblePartyName: responsibleParty ? getFirstName(responsibleParty) ?? '--' : '--',
    responsiblePartyRelationshipToPatient: getResponsiblePartyRelationship(responsibleParty) ?? '--',
    amountInvoiceable: `${patientBalance}`,
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
