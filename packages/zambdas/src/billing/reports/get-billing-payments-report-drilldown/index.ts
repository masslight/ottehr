import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import {
  GetBillingPaymentsReportDrilldownResponse,
  PaymentsReportDrilldownEra,
} from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import {
  extractClaimResponseAmounts,
  extractReportedCharge,
  fetchClaimResponsesByPaymentReconciliations,
  sortClaimResponsesByRecency,
} from '../../claim-amounts';
import { eraPatientAccountNumber } from '../../era-remits';
import {
  createBillingClient,
  createEraReadClient,
  fhirName,
  getEraCheckNumber,
  resolvePayersByRef,
} from '../../shared';
import {
  checkDateInRange,
  claimResponseClaimId,
  claimResponseServiceDay,
  eraCheckMonth,
  eraPayerRef,
  eraReportedPayerName,
  fetchAllEras,
  fetchPartialClaimsById,
  payerIdFromRef,
  payerNamesByRef,
  toMonth,
  UNKNOWN_PAYER_NAME,
  WATERFALL_UNKNOWN_MONTH,
} from '../shared';
import { GetBillingPaymentsReportDrilldownParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-payments-report-drilldown';

// sentinel for payer rows built from ERAs that carry no payer reference at all
export const NO_PAYER_SENTINEL = 'none';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, eraReadClient, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// ERAs matching a payer row (payerId + check window) or a waterfall cell (serviceMonth + checkMonth),
// each with its claims and remit service lines.
export async function performEffect(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: GetBillingPaymentsReportDrilldownParams
): Promise<GetBillingPaymentsReportDrilldownResponse> {
  const allEras = await fetchAllEras(eraReadClient);
  if (allEras.length === 0) return { eras: [] };

  const claimResponsesByPrId = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, allEras);
  const allClaimResponses = [...claimResponsesByPrId.values()].flat();
  const harvestedNamesByRef = payerNamesByRef(allClaimResponses);
  const [payersByRef, partialClaimsById] = await Promise.all([
    resolvePayersByRef(oystehr, [
      ...allEras.map((pr) => pr.paymentIssuer?.reference),
      ...allClaimResponses.map((cr) => cr.insurer?.reference),
    ]),
    fetchPartialClaimsById(oystehr, allClaimResponses.map(claimResponseClaimId).filter(Boolean) as string[]),
  ]);

  const eras: PaymentsReportDrilldownEra[] = [];
  for (const era of allEras) {
    const claimResponses = sortClaimResponsesByRecency(claimResponsesByPrId.get(era.id ?? '') ?? []);

    if (params.checkMonth && eraCheckMonth(era) !== params.checkMonth) continue;
    if (!params.checkMonth && !checkDateInRange(era, params.dateFrom, params.dateTo)) continue;

    if (params.payerId) {
      const refId = payerIdFromRef(eraPayerRef(era, claimResponses));
      if (params.payerId === NO_PAYER_SENTINEL ? refId !== undefined : refId !== params.payerId) continue;
    }

    // a waterfall cell only shows the claims whose DOS lands in its service month
    const matching = params.serviceMonth
      ? claimResponses.filter(
          (cr) =>
            (toMonth(claimResponseServiceDay(cr, partialClaimsById) ?? undefined) ?? WATERFALL_UNKNOWN_MONTH) ===
            params.serviceMonth
        )
      : claimResponses;
    if (matching.length === 0) continue;

    const payerRef = eraPayerRef(era, claimResponses);
    const refPayerId = payerIdFromRef(payerRef);
    const payer = payerRef ? payersByRef.get(payerRef) : undefined;
    eras.push({
      id: era.id ?? '',
      checkNumber: getEraCheckNumber(era) ?? '',
      checkDate: era.paymentDate ?? era.created ?? '',
      payerName:
        payer?.name ??
        harvestedNamesByRef.get(payerRef ?? '') ??
        eraReportedPayerName(claimResponses) ??
        era.paymentIssuer?.display ??
        (refPayerId ? `Payer ${refPayerId}` : UNKNOWN_PAYER_NAME),
      checkAmount: era.paymentAmount?.value ?? 0,
      claims: matching.map((claimResponse) => {
        const amounts = extractClaimResponseAmounts(claimResponse);
        const claimId = claimResponseClaimId(claimResponse);
        const matchedClaim = claimId ? partialClaimsById.get(claimId) : undefined;
        const containedPatient = claimResponse.contained?.find(
          (resource): resource is Patient => resource.resourceType === 'Patient'
        );
        return {
          patientName: fhirName(containedPatient),
          pcn: eraPatientAccountNumber([claimResponse], matchedClaim, !!matchedClaim),
          dos: claimResponseServiceDay(claimResponse, partialClaimsById) ?? '',
          billed: extractReportedCharge(claimResponse) ?? 0,
          allowed: amounts.allowed ?? 0,
          paid: amounts.paid,
          patientResp: amounts.patientResp ?? 0,
        };
      }),
    });
  }

  eras.sort((a, b) => b.checkDate.localeCompare(a.checkDate));
  return { eras };
}
