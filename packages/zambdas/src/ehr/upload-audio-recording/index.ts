import { APIGatewayProxyResult } from 'aws-lambda';
import { CreateUploadAudioRecordingInput, CreateUploadAudioRecordingOutput, Secrets } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { makeZ3UrlForVisitAudio } from '../../shared/presigned-file-urls/helpers';
import { createPresignedUrl } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

export interface CreateUploadAudioRecordingInputValidated extends CreateUploadAudioRecordingInput {
  secrets: Secrets | null;
}

const ZAMBDA_NAME = 'upload-audio-recording';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`handler() start.`);
    const validatedInput = validateRequestParameters(input);
    const { secrets, visitID } = validatedInput;
    console.log(`validatedInput => `);
    console.log(JSON.stringify(validatedInput));

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    console.log(`Got m2mToken`);

    const fileZ3Url = makeZ3UrlForVisitAudio({ secrets, bucketName: 'audio-recordings', fileName: `${visitID}.webm` });
    const presignedFileUploadUrl = await createPresignedUrl(m2mToken, fileZ3Url, 'upload');

    console.log(`created fileZ3Url: [${fileZ3Url}] :: presignedFileUploadUrl: [${presignedFileUploadUrl}]`);

    const response: CreateUploadAudioRecordingOutput = {
      z3URL: fileZ3Url,
      presignedUploadUrl: presignedFileUploadUrl,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    throw error;
  } finally {
    console.log(`handler() end`);
  }
});
