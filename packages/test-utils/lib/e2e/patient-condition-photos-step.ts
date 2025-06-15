import { Attachment } from 'fhir/r4b';
import { promises as fsPromises } from 'fs';
import { DateTime } from 'luxon';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  addContentTypeToAttachment,
  chooseJson,
  GetPresignedFileURLInput,
  PatchPaperworkParameters,
  PresignUploadUrlResponse,
} from 'utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getPatientConditionPhotosStepAnswers({
  zambdaUrl,
  authToken,
  projectId,
  appointmentId,
  fileName,
}: {
  zambdaUrl: string;
  authToken: string;
  projectId: string;
  appointmentId: string;
  fileName: string;
}): Promise<PatchPaperworkParameters['answers']> {
  const getPathToProjectRoot = (currentPath: string): string => {
    if (currentPath.split('/').at(-1) === 'ottehr') {
      return currentPath;
    }
    return getPathToProjectRoot(resolve(currentPath, '..'));
  };

  const filePath = join(getPathToProjectRoot(__dirname), `apps/intake/images-for-tests/${fileName}`);
  const response = await fsPromises.readFile(filePath, 'binary');

  const blob = new Blob([response], { type: 'application/jpg' });

  const file = new File([blob], 'filename.jpg', { type: blob.type });

  const presignedFileUrlResponse = await fetch(`${zambdaUrl}/zambda/get-presigned-file-url/execute-public`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      'x-zapehr-project-id': projectId,
    },
    body: JSON.stringify(<GetPresignedFileURLInput>{
      appointmentID: appointmentId,
      fileType: 'patient-photos' as GetPresignedFileURLInput['fileType'],
      fileFormat: file.type.split('/')[1] as GetPresignedFileURLInput['fileFormat'],
    }),
  });
  if (!presignedFileUrlResponse.ok) {
    throw new Error(
      `Error getting presigned file URL: ${presignedFileUrlResponse}, body: ${JSON.stringify(
        await presignedFileUrlResponse.json()
      )}`
    );
  }

  const presignedFileUrlBody = chooseJson(await presignedFileUrlResponse.json()) as PresignUploadUrlResponse;

  console.log(presignedFileUrlBody);
  const uploadResponse = await fetch(presignedFileUrlBody.presignedURL, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file');
  }

  const attachment: Attachment = {
    url: presignedFileUrlBody.z3URL,
    title: 'patient-photos',
    creation: DateTime.now().toISO(),
  };

  return {
    linkId: 'patient-condition-page',
    item: [{ linkId: 'patient-photos', answer: [{ valueAttachment: addContentTypeToAttachment(attachment) }] }],
  };
}
