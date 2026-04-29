import { BucketName, MIME_TYPES, Secrets } from 'utils';
import { makeZ3Url } from '../../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../../z3Utils';

export const uploadLabelXmlToZ3 = async (
  xmlString: string,
  fileName: string,
  bucketName: BucketName,
  patientId: string, // should be the uuid
  token: string,
  secrets: Secrets | null
): Promise<string> => {
  console.log(`Creating base file url for file ${fileName}`);

  const baseFileUrl = makeZ3Url({
    secrets,
    fileName,
    bucketName: bucketName,
    patientID: patientId,
  });

  console.log('Uploading file to bucket, ', bucketName);
  const encoder = new TextEncoder();
  const xmlStringAsUint8Array = encoder.encode(xmlString);

  try {
    const uploadPresignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
    await uploadObjectToZ3(xmlStringAsUint8Array, uploadPresignedUrl, MIME_TYPES.XML);
  } catch (error: any) {
    throw new Error(`failed uploading xml label ${fileName} to z3:  ${JSON.stringify(error.message)}`);
  }
  console.log('Successfully uploaded xml label file', baseFileUrl);
  return baseFileUrl;
};
