import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils/lib/fhir/radiology';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { DeleteRadiologyResultZambdaOutput } from 'utils/lib/types/api/radiology';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { deleteZ3Object } from '../../../shared/z3Utils';
import { findExistingFolderList } from '../../shared/patient-document-folders';
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

  // Only radiology result documents attached to a ServiceRequest may be deleted through this endpoint.
  const isRadiologyResult = docRef.type?.coding?.some(
    (coding) =>
      coding.system === RADIOLOGY_RESULT_DOC_REF_DOCTYPE.system && coding.code === RADIOLOGY_RESULT_DOC_REF_DOCTYPE.code
  );
  const isRelatedToServiceRequest = docRef.context?.related?.some(
    (related) => related.reference?.startsWith('ServiceRequest/')
  );
  if (!isRadiologyResult || !isRelatedToServiceRequest) {
    throw new Error('DocumentReference is not a radiology result attached to an order');
  }
  const patientId = removePrefix('Patient/', docRef.subject?.reference ?? '');
  if (!patientId) {
    throw new Error(`DocumentReference/${docRef.id} has no patient subject`);
  }

  // Best-effort delete of the backing Z3 file before removing the DocumentReference.
  const fileUrl = docRef.content?.[0]?.attachment?.url;
  if (fileUrl) {
    try {
      await deleteZ3Object(fileUrl, m2mToken);
    } catch (error) {
      console.error('Failed to delete Z3 object for radiology result, removing DocumentReference anyway:', error);
    }
  }

  const docRefReference = `DocumentReference/${docRef.id}`;
  const radiologyReportsFolder = await findExistingFolderList({
    patientId,
    internalName: BUCKET_NAMES.RADIOLOGY_REPORTS,
    isCustom: false,
    oystehr,
  });
  if (radiologyReportsFolder?.entry?.some((entry) => entry.item.reference === docRefReference)) {
    await oystehr.fhir.patch<List>({
      resourceType: 'List',
      id: radiologyReportsFolder.id!,
      operations: [
        replaceOperation(
          '/entry',
          radiologyReportsFolder.entry.filter((entry) => entry.item.reference !== docRefReference)
        ),
      ],
    });
  }

  await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: body.documentReferenceId });

  const output: DeleteRadiologyResultZambdaOutput = {};
  return { statusCode: 200, body: JSON.stringify(output) };
});
