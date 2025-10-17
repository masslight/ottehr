import { Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PDF_ATTACHMENT_BASE64_STRING, PDF_ATTACHMENT_CODE } from './lab-script-consts';

export const createPdfAttachmentObs = (): Observation => {
  return {
    resourceType: 'Observation',
    status: 'final',
    code: PDF_ATTACHMENT_CODE,
    extension: [
      {
        url: 'https://extensions.fhir.oystehr.com/observation-value-attachment-pre-release',
        valueAttachment: {
          data: PDF_ATTACHMENT_BASE64_STRING,
          contentType: 'AP/PDF',
          creation: DateTime.now().toISO(),
        },
      },
    ],
  };
};
