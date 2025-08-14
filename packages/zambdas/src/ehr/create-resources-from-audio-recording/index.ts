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

const PROMPT = 'give a transcript of this file include only the transcript without other input';

export interface CreateResourcesFromAudioRecordingInputValidated extends CreateResourcesFromAudioRecordingInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const { visitID, z3URL, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    // const presignedFileDownloadUrl = await createPresignedUrl(m2mToken, z3URL, 'download');
    const presignedFileDownloadUrl = await createPresignedUrl(m2mToken, z3URL, 'download');
    console.log(presignedFileDownloadUrl);
    const file = await fetch(presignedFileDownloadUrl);
    const fileBlob = await file.arrayBuffer();
    const fileBase64 = Buffer.from(fileBlob).toString('base64');
    // const fileBase64 = btoa(String.fromCharCode(...new Uint8Array(fileBlob)));

    console.log(PROMPT);
    const transcript = await invokeChatbotVertexAI(
      [{ text: PROMPT }, { inlineData: { mimeType: 'audio/mpeg', data: fileBase64 } }],
      secrets
    );
    console.log(transcript);

    const createdResources = await createResourcesFromAiInterview(oystehr, visitID, transcript, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(`Successfully created ` + createdResources),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('create-upload-document-url', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating resources from recording, ${JSON.stringify(error)}` }),
    };
  }
});
