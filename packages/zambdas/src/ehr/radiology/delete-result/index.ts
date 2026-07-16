import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DeleteRadiologyResultZambdaOutput } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { deleteZ3Object } from '../../../shared/z3Utils';
import { validateInput, validateSecrets } from './validation';

let m2mToken: string;

const ZAMBDA_NAME = 'radiology-delete-result';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);
  const { body } = validateInput(unsafeInput);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const docRef = await oystehr.fhir.get<DocumentReference>({
    resourceType: 'DocumentReference',
    id: body.documentReferenceId,
  });

  // Best-effort delete of the backing Z3 file before removing the DocumentReference.
  const fileUrl = docRef.content?.[0]?.attachment?.url;
  if (fileUrl) {
    try {
      await deleteZ3Object(fileUrl, m2mToken);
    } catch (error) {
      console.error('Failed to delete Z3 object for radiology result, removing DocumentReference anyway:', error);
    }
  }

  await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: body.documentReferenceId });

  const output: DeleteRadiologyResultZambdaOutput = {};
  return { statusCode: 200, body: JSON.stringify(output) };
});
