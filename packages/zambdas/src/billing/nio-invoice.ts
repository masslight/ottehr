import Oystehr from '@oystehr/sdk';
import { Claim, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getClaimNonInsurancePayer } from 'utils/lib/fhir/billing';
import { BuildBillingInvoiceInput, getBillingInvoiceClaims, isSameInvoiceIssuer } from 'utils/lib/fhir/billing-invoice';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { AR_STAGE, formatAntCaseString, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import {
  BILLING_INVOICE_CONFLICT_ERROR,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { readInvoicingConfig } from '../rcm/invoice-config/helpers';
import { NioInvoicePdfData } from '../shared/pdf/nio-invoice-pdf';
import { buildClaimLookups, getClaimServiceDay, mapClaimToItem } from './claim-search';
import { INVOICE_ISSUER_CLAIM_INCLUDES, resolveClaimInvoiceIssuer } from './invoice-issuer';
import { fetchActiveClaimInvoices } from './invoices';
import { copySourceId, fetchById, fhirName, findRef } from './shared';

export interface NioInvoiceDraft {
  nioId: string;
  invoice: BuildBillingInvoiceInput;
  pdf: Omit<NioInvoicePdfData, 'invoiceNumber'>;
}

const ISSUER_SOURCE_LABELS = {
  'service-facility': 'service facility',
  'billing-provider': 'billing provider',
} as const;

// Names match the claims list rows. Off by default: thrown errors get logged, so names leak PHI.
const describeClaims = (claims: Claim[], resources: Resource[], nameClaims: boolean): string => {
  if (!nameClaims) return `${claims.length} ${claims.length === 1 ? 'claim' : 'claims'}`;
  return claims
    .map((claim) => {
      const patient = findRef<Patient>(resources, claim.patient?.reference);
      return `${fhirName(patient)} (${getClaimServiceDay(claim)})`;
    })
    .join('; ');
};

// Checks the claims can go on one NIO invoice together and builds what the invoice and its PDF
// need. Nothing is saved, so preview and create both start here. A create that resumes passes the
// invoice it already saved, so the claims aren't refused for being on it.
export async function assembleNioInvoice({
  oystehr,
  claimIds,
  resumedInvoiceId,
  nameClaims = false,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  claimIds: string[];
  resumedInvoiceId?: string;
  nameClaims?: boolean;
  now?: DateTime;
}): Promise<NioInvoiceDraft> {
  const resources = (
    await oystehr.fhir.search<Claim | Patient | Location | Organization | Practitioner>({
      resourceType: 'Claim',
      params: [
        {
          name: '_id',
          value: claimIds.join(','),
        },
        ...INVOICE_ISSUER_CLAIM_INCLUDES,
        {
          name: '_include',
          value: 'Claim:patient',
        },
        {
          name: '_count',
          value: String(claimIds.length),
        },
      ],
    })
  ).unbundle() as Resource[];
  const claimsById = new Map(
    resources.filter((resource): resource is Claim => resource.resourceType === 'Claim').map((c) => [c.id, c])
  );
  const missing = claimIds.filter((id) => !claimsById.has(id));
  if (missing.length > 0) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Claims not found: ${missing.join(', ')}`);
  const claims = claimIds.map((id) => claimsById.get(id)!);

  const notReady = claims.filter((claim) => {
    const { arStage, nonInsuranceArStatus } = getClaimStatusValues(claim);
    return arStage !== AR_STAGE.nonInsurancePayer || nonInsuranceArStatus !== 'ready-to-invoice';
  });
  if (notReady.length > 0) {
    const subject = describeClaims(notReady, resources, nameClaims);
    throw INVALID_INPUT_ERROR(`${subject} must be in Non-Insurance Payer AR with a status of Ready to invoice`);
  }

  const nioReferences = new Set(claims.map((claim) => getClaimNonInsurancePayer(claim)?.reference));
  const [nioReference] = nioReferences;
  const nioId = getIdFromReference(nioReference, 'Organization');
  if (nioReferences.size > 1 || !nioId) {
    throw INVALID_INPUT_ERROR('All claims must have the same non-insurance payer');
  }

  const [{ invoiceIssuerSource, dueDaysFromGeneration }, lookups, activeInvoices, nio] = await Promise.all([
    readInvoicingConfig(oystehr),
    buildClaimLookups({
      oystehr,
      claims,
      includedResources: resources,
    }),
    fetchActiveClaimInvoices(oystehr, claimIds),
    fetchById<Organization>(oystehr, 'Organization', nioId),
  ]);

  const issuers = claims.map((claim) => resolveClaimInvoiceIssuer(claim, resources, invoiceIssuerSource));
  if (!issuers.every((issuer) => isSameInvoiceIssuer(issuer, issuers[0]))) {
    throw INVALID_INPUT_ERROR(`All claims must have the same ${ISSUER_SOURCE_LABELS[invoiceIssuerSource]}`);
  }

  const otherInvoices = activeInvoices.filter((invoice) => !resumedInvoiceId || invoice.id !== resumedInvoiceId);
  const invoiced = claims.filter((claim) =>
    otherInvoices.some((invoice) => getBillingInvoiceClaims(invoice).some(({ claimId }) => claimId === claim.id))
  );
  if (invoiced.length > 0) {
    const verb = invoiced.length === 1 ? 'is' : 'are';
    throw BILLING_INVOICE_CONFLICT_ERROR(
      `${describeClaims(invoiced, resources, nameClaims)} ${verb} already on an invoice`
    );
  }

  const items = claims.map((claim) => mapClaimToItem(claim, lookups));
  const noBalance = claims.filter((_, index) => items[index].claimBalance <= 0);
  if (noBalance.length > 0) {
    const verb = noBalance.length === 1 ? 'has' : 'have';
    throw INVALID_INPUT_ERROR(`${describeClaims(noBalance, resources, nameClaims)} ${verb} no balance to invoice`);
  }

  if (!nio.name) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`Non-insurance payer ${nioId} has no name`);

  const facilityIds = new Set(
    claims.map((claim) => copySourceId(findRef<Location>(resources, claim.facility?.reference)))
  );
  const [facilityId] = facilityIds;
  const issueDate = now.toISODate()!;
  const dueDate = now.plus({ days: dueDaysFromGeneration }).toISODate()!;
  const lines = items.map((item) => ({
    claimId: item.id,
    patientName: item.patientName,
    serviceDate: item.serviceDate,
    service: formatAntCaseString(item.service),
    amountCents: Math.round(item.claimBalance * 100),
  }));

  return {
    nioId,
    invoice: {
      status: 'issued',
      date: now.toUTC().toISO()!,
      dueDate,
      issuer: issuers[0].organization,
      recipient: {
        reference: `Organization/${nioId}`,
        display: nio.name,
      },
      claims: lines.map(({ claimId, amountCents }) => ({
        claimId,
        amountCents,
      })),
      facilityId: facilityIds.size === 1 ? facilityId : undefined,
    },
    pdf: {
      issueDate,
      dueDate,
      issuer: {
        name: issuers[0].name,
        address: issuers[0].address,
      },
      billTo: {
        name: nio.name,
        address: nio.address?.[0],
      },
      lines,
    },
  };
}
