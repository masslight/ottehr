import { APIGatewayProxyResult } from 'aws-lambda';
import { CreateResourcesFromAudioRecordingInput, getSecret, Secrets, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  createPresignedUrl,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createResourcesFromAiInterview, invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'create-resources-from-audio-recording';

const TRANSCRIPT_PROMPT =
  'give a transcript of this file, include only the transcript without other input, include who the speaker is with labels for the provider and the patient';
export interface CreateResourcesFromAudioRecordingInputValidated extends CreateResourcesFromAudioRecordingInput {
  userToken: string;
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const { userToken, z3URL, duration, visitID, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const providerUserProfile = (await oystehrCurrentUser.user.me()).profile;

    const presignedFileDownloadUrl = await createPresignedUrl(m2mToken, z3URL, 'download');
    console.log(presignedFileDownloadUrl);
    const file = await fetch(presignedFileDownloadUrl);
    const fileBlob = await file.arrayBuffer();
    const fileBase64 = Buffer.from(fileBlob).toString('base64');
    const mimeType = file.headers.get('Content-Type') || 'unknown';

    const transcript = await invokeChatbotVertexAI(
      [{ text: TRANSCRIPT_PROMPT }, { inlineData: { mimeType: mimeType, data: fileBase64 } }],
      secrets
    );

    const createdResources = await createResourcesFromAiInterview(
      oystehr,
      visitID,
      transcript,
      z3URL,
      duration,
      mimeType,
      providerUserProfile,
      secrets
    );

    return {
      statusCode: 200,
      body: JSON.stringify(`Successfully created ` + createdResources),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-resources-from-audio-recording', error, ENVIRONMENT);
  }
});
