import { DocumentReference } from 'fhir/r4b';

export function getContentOfDocumentReference(documentReference: DocumentReference, title: string): string | undefined {
  const content = documentReference?.content?.find((content) => content.attachment.title === title)?.attachment.data;
  if (content == undefined) {
    return undefined;
  }
  return decodeURIComponent(escape(atob(content)));
}
