import { Attachment } from 'fhir/r4b';
import { getMimeType } from '../../utils';

export const addContentTypeToAttachment = (attachment: Attachment): Attachment => {
  if (attachment.contentType || !attachment.url) {
    return { ...attachment };
  }

  const contentType = getMimeType(attachment.url);

  return {
    ...attachment,
    contentType,
  };
};
