import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClaimResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CREATE_TIMELY_FILING_REPORT_ZAMBDA } from 'utils/lib/types/data/billing/billing.constants';
import { CreateTimelyFilingReportResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { composeTimelyFilingReportData, renderTimelyFilingReportPdf } from '../../shared/pdf/timely-filing-report-pdf';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { fetchClaimAcknowledgmentEvents, fetchClaimTransmitEvent } from '../claim-acknowledgments';
import { fetchClaimResponsesByClaimIds } from '../claim-amounts';
import {
  createBillingClient,
  createEraReadClient,
  ERA_ICN_EXTENSION,
  fetchClaimGraph,
  getClaimPcn,
  getEraExtensionString,
  resolvePayersByRef,
} from '../shared';
import { CreateTimelyFilingReportParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = CREATE_TIMELY_FILING_REPORT_ZAMBDA;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);
  // The status responses and ERAs the trail is read from are written by Oystehr without the billing
  // tag, so they are read with the untagged client.
  const eraReadClient = createEraReadClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    eraReadClient,
    params,
  });
  console.groupEnd();
  console.debug('performEffect success', { fileName: response.fileName });

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect({
  oystehr,
  eraReadClient,
  params,
}: {
  oystehr: Oystehr;
  eraReadClient: Oystehr;
  params: CreateTimelyFilingReportParams;
}): Promise<CreateTimelyFilingReportResponse> {
  const { claimId } = params;

  const [graph, acknowledgments, transmit, claimResponsesByClaim] = await Promise.all([
    fetchClaimGraph(oystehr, claimId),
    fetchClaimAcknowledgmentEvents({
      oystehr,
      claimId,
    }),
    fetchClaimTransmitEvent({
      oystehr: eraReadClient,
      claimId,
    }),
    fetchClaimResponsesByClaimIds(eraReadClient, [claimId]),
  ]);
  const { claim, patient, billingProvider, renderingProvider, coverages } = graph;

  const payersByRef = await resolvePayersByRef(oystehr, [claim.insurer?.reference]);
  const payer = claim.insurer?.reference ? payersByRef.get(claim.insurer.reference) : undefined;

  const data = composeTimelyFilingReportData({
    claim,
    patient,
    billingProvider,
    renderingProvider,
    coverage: coverages[0],
    payer,
    acknowledgments,
    transmit,
    eraPayerClaimControlNumber: eraPayerClaimControlNumber(claimResponsesByClaim.get(claimId) ?? []),
    now: DateTime.now().toISO(),
  });

  return {
    fileName: timelyFilingReportFileName(claim.id ?? claimId, getClaimPcn(claim)),
    pdfBase64: Buffer.from(await renderTimelyFilingReportPdf(data)).toString('base64'),
  };
}

export function timelyFilingReportFileName(claimId: string, pcn: string | undefined): string {
  const stamp = DateTime.now().toFormat('yyyyMMdd_HHmmss');
  return `Timely_Filing_Report_${pcn || claimId}_${stamp}.pdf`;
}

function eraPayerClaimControlNumber(claimResponses: ClaimResponse[]): string | undefined {
  return claimResponses.map((response) => getEraExtensionString(response, ERA_ICN_EXTENSION)).find(Boolean);
}
