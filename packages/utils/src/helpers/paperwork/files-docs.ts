import { Attachment } from 'fhir/r4b';

export const addContentTypeToAttachment = (attachment: Attachment): Attachment => {
  if (attachment.contentType || !attachment.url) {
    return { ...attachment };
  }
  const urlExt = attachment.url.split('.').slice(-1).toString();
  switch (urlExt) {
    case 'pdf':
      return {
        ...attachment,
        contentType: 'application/pdf',
      };
    case 'jpg':
      return {
        ...attachment,
        contentType: 'image/jpeg',
      };
    default:
      return {
        ...attachment,
        contentType: `image/${urlExt}`,
      };
  }
};
