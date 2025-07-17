import { APIGatewayProxyResult } from 'aws-lambda';
import { GetOrUploadPatientProfilePhotoInputValidated, getSecret, Secrets, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createPresignedUrl } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const logIt = (msg: string): void => {
  console.log(`PatientProfilePhoto: ${msg}`);
};

const PATIENT_PHOTO_ID_PREFIX = 'patient-photo';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
const ZAMBDA_NAME = 'get-patient-profile-photo-url';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters: GetOrUploadPatientProfilePhotoInputValidated;

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    const { secrets, action } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    logIt(`Got m2mToken`);
    const token = m2mToken;

    let z3PhotoUrl: string | undefined;

    if (action === 'upload') {
      const { patientId } = validatedParameters;
      const bucketName = `${PATIENT_PHOTO_ID_PREFIX}s`;
      z3PhotoUrl = makeZ3Url({ secrets, bucketName, patientId });
      logIt(`Created image's z3Url=[${z3PhotoUrl}]`);
    } else {
      z3PhotoUrl = validatedParameters.z3PhotoUrl;
    }

    logIt(`Pre-signing this URL ...`);
    const presignedDownloadUrl = await createPresignedUrl(token, z3PhotoUrl, action);
    logIt(`Signed download URL value=[${presignedDownloadUrl}]`);
    const resolvedPresignedUrl = presignedDownloadUrl;
    const resolvedZ3ImageFileUrl = z3PhotoUrl;

    const response = {
      z3ImageUrl: resolvedZ3ImageFileUrl,
      presignedImageUrl: resolvedPresignedUrl,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('update-patient-profile-photo', error, ENVIRONMENT);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ message: `Error updating patient's photo: ${error.message || error}` }),
    };
  }
});

const makeZ3Url = (input: { secrets: Secrets | null; bucketName: string; patientId: string }): string => {
  const { secrets, bucketName, patientId } = input;
  const fileType = 'patient-photo';
  const fileFormat = 'image';
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${projectId}-${bucketName}/${patientId}/${Date.now()}-${fileType}.${fileFormat}`;
  return fileURL;
};
