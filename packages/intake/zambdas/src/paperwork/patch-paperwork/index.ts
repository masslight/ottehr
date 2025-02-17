import Oystehr from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { QuestionnaireResponse } from 'fhir/r4b';
import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { topLevelCatch } from 'zambda-utils';
import '../../../instrument.mjs';
import { getAuth0Token } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { PatchPaperworkEffectInput, validatePatchInputs } from '../validateRequestParameters';

// Lifting the token out of the handler function allows it to persist across warm lambda invocations.
export let token: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input body: ${JSON.stringify(input.body)}`);
  try {
    const secrets = input.secrets;
    if (!token) {
      console.log('getting token');
      token = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(token, secrets);

    const effectInput = await validatePatchInputs(input, oystehr);

    console.log('effect input', JSON.stringify(effectInput));

    const qr = await performEffect(effectInput, oystehr);
    /*
    todo
    try {
      await createAuditEvent(AuditableZambdaEndpoints.patchPaperwork, oystehr, input, patientId, secrets);
    } catch (e) {
      console.log('error writing audit event', e);
    }
      */

    return {
      statusCode: 200,
      body: JSON.stringify(qr),
    };
  } catch (error: any) {
    return topLevelCatch('patch-paperwork', error, input.secrets);
  }
});

const performEffect = async (input: PatchPaperworkEffectInput, oystehr: Oystehr): Promise<QuestionnaireResponse> => {
  const { updatedAnswers, questionnaireResponseId, currentQRStatus, patchIndex } = input;
  console.log('patchIndex:', patchIndex);
  console.log('updatedAnsewers', JSON.stringify(updatedAnswers));
  const operations: Operation[] = [
    {
      op: 'add',
      path: `/item/${patchIndex}/item`,
      value: updatedAnswers,
    },
  ];

  if (currentQRStatus === 'completed') {
    operations.push({
      op: 'replace',
      path: '/status',
      value: 'amended',
    });
  }

  return oystehr.fhir.patch<QuestionnaireResponse>({
    id: questionnaireResponseId,
    resourceType: 'QuestionnaireResponse',
    operations,
  });
};
