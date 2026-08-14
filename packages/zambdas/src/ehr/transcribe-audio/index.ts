import { APIGatewayProxyResult } from 'aws-lambda';
import { TranscribeAudioOutput } from 'utils/lib/types/data/easy-charting.types';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createPresignedUrl } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'transcribe-audio';

let m2mToken: string;

const TRANSCRIPT_PROMPT =
  'give a transcript of this file, include only the transcript without other input, include who the speaker is with labels for the provider and the patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { z3URL, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

  const presignedDownloadUrl = await createPresignedUrl(m2mToken, z3URL, 'download');
  const file = await fetch(presignedDownloadUrl);
  const fileBlob = await file.arrayBuffer();
  const fileBase64 = Buffer.from(fileBlob).toString('base64');
  const mimeType = file.headers.get('Content-Type') || 'audio/webm';

  const transcript = await invokeChatbotVertexAI(
    [{ text: TRANSCRIPT_PROMPT }, { inlineData: { mimeType, data: fileBase64 } }],
    secrets
  );

  const output: TranscribeAudioOutput = { transcript };
  return { statusCode: 200, body: JSON.stringify(output) };
});
