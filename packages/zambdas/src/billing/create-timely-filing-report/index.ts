import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClaimResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CreateTimelyFilingReportResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { composeTimelyFilingReportData, renderTimelyFilingReportPdf } from '../../shared/pdf/timely-filing-report-pdf';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { uploadObjectToZ3 } from '../../shared/z3Utils';
import { fetchClaimAcknowledgmentEvents, fetchClaimTransmitEvent } from '../claim-acknowledgments';
import { fetchClaimResponsesByClaimIds } from '../claim-amounts';
import { claimAttachmentUploadTarget, recordClaimAttachment } from '../claim-attachments';
import {
  BILLING_APP_BUCKET,
  createBillingClient,
  createEraReadClient,
  ERA_ICN_EXTENSION,
  fetchClaimGraph,
  getClaimPcn,
  getEraExtensionString,
  resolvePayersByRef,
} from '../shared';
import { CreateTimelyFilingReportParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'create-timely-filing-report';

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
  console.debug('performEffect success', response);

  return {
    statusCode: 201,
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
  const { claimId, secrets } = params;

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

  const fileName = timelyFilingReportFileName(claim.id ?? claimId, getClaimPcn(claim));
  const target = await claimAttachmentUploadTarget({
    oystehr,
    claimId: claim.id ?? claimId,
    name: fileName,
    secrets,
  });

  await uploadObjectToZ3(await renderTimelyFilingReportPdf(data), target.uploadUrl);

  const documentReferenceId = await recordClaimAttachment({
    oystehr,
    claim: {
      ...claim,
      id: claim.id ?? claimId,
    },
    name: fileName,
    fileName: target.fileName,
    secrets,
  });
  if (!documentReferenceId) {
    throw INVALID_INPUT_ERROR(`Could not record the timely filing report against Claim/${claimId}`);
  }

  const download = await oystehr.z3.getPresignedUrl({
    bucketName: BILLING_APP_BUCKET(secrets['PROJECT_ID']),
    'objectPath+': target.objectPath,
    action: 'download',
  });

  return {
    downloadUrl: download.signedUrl,
    documentReferenceId,
    fileName,
  };
}

export function timelyFilingReportFileName(claimId: string, pcn: string | undefined): string {
  const stamp = DateTime.now().toFormat('yyyyMMdd_HHmmss');
  return `Timely_Filing_Report_${pcn || claimId}_${stamp}.pdf`;
}

function eraPayerClaimControlNumber(claimResponses: ClaimResponse[]): string | undefined {
  return claimResponses.map((response) => getEraExtensionString(response, ERA_ICN_EXTENSION)).find(Boolean);
}
