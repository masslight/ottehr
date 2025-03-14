import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken } from '../shared/helpers';
import { createPresignedUrl } from '../shared/z3Utils';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';

const logIt = (msg: string): void => {
  console.log(`PatientProfilePhoto: ${msg}`);
};

const PATIENT_PHOTO_ID_PREFIX = 'patient-photo';
export interface UpdatePatientPhotoInput {
  secrets: Secrets | null;
  patientID: string;
  action: 'upload' | 'download';
  z3PhotoUrl?: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, patientID, action, z3PhotoUrl } = validateRequestParameters(input);
    logIt(`Parameters VALIDATED patId=[${patientID}] :: action=[${action}]`);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    logIt(`Got m2mToken`);

    const token = m2mtoken;

    let resolvedPresignedUrl = undefined;
    let resolvedZ3ImageFileUrl = undefined;
    if (action === 'upload') {
      const bucketName = `${PATIENT_PHOTO_ID_PREFIX}s`;
      const z3ImageFileUrl = makeZ3Url({ secrets, bucketName, patientID });
      resolvedZ3ImageFileUrl = z3ImageFileUrl;
      logIt(`Created image's z3Url=[${z3ImageFileUrl}]`);

      logIt(`Pre-signing this URL ...`);
      const presignedUploadUrl = await createPresignedUrl(token, z3ImageFileUrl, 'upload');
      logIt(`Signed upload URL value=[${presignedUploadUrl}]`);
      resolvedPresignedUrl = presignedUploadUrl;
    } else if (action === 'download' && z3PhotoUrl) {
      const presignedDownloadUrl = await createPresignedUrl(token, z3PhotoUrl, 'download');
      logIt(`Signed download URL value=[${presignedDownloadUrl}]`);
      resolvedPresignedUrl = presignedDownloadUrl;
      resolvedZ3ImageFileUrl = z3PhotoUrl;
    }

    const response = {
      z3ImageUrl: resolvedZ3ImageFileUrl,
      presignedImageUrl: resolvedPresignedUrl,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('update-patient-profile-photo', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

const makeZ3Url = (input: { secrets: Secrets | null; bucketName: string; patientID: string }): string => {
  const { secrets, bucketName, patientID } = input;
  const fileType = 'patient-photo';
  const fileFormat = 'image';
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${projectId}-${bucketName}/${patientID}/${Date.now()}-${fileType}.${fileFormat}`;
  return fileURL;
};
