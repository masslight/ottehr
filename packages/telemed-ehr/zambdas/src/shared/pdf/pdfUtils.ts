import { DocumentReference } from 'fhir/r4';
import { Secrets } from 'ehr-utils';
import { getSecret, SecretsKeys } from '../secrets';
import { PDFFont } from 'pdf-lib';

export type PdfInfo = { uploadURL: string; title: string };

export const PdfDocumentReferencePublishedStatuses: { [key: string]: 'final' | 'preliminary' } = {
  published: 'final',
  unpublished: 'preliminary',
};

export function isDocumentPublished(doc: DocumentReference): boolean {
  return doc.docStatus === PdfDocumentReferencePublishedStatuses.published;
}

export function handleBadSpaces(text: string): string {
  return text.replace(' ', ' ');
}

export function createBaseFileUrl(secrets: Secrets | null, fileName: string, bucket: string): string {
  return `${getSecret(SecretsKeys.PROJECT_API, secrets)}/z3/${bucket}/${Date.now()}-${fileName}`;
}

export function splitLongStringToPageSize(
  text: string,
  font: PDFFont,
  fontSize: number,
  desiredWidth: number,
): string[] {
  const inputStrings = text.split('\n'); // handle new lines first
  const resultStrings: string[] = [];

  inputStrings.forEach((str) => {
    const words = str.split(' ');

    let validLine = '';
    let lineWidth = 0;
    words.forEach((word) => {
      const wordWidth = font.widthOfTextAtSize(word + ' ', fontSize);
      if (lineWidth + wordWidth <= desiredWidth) {
        validLine = `${validLine.concat(word)} `;
        lineWidth += wordWidth;
      } else {
        resultStrings.push(validLine);
        validLine = word;
        lineWidth = wordWidth;
      }
    });
    resultStrings.push(validLine);
  });
  return resultStrings;
}
