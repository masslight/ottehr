import { Operation } from 'fast-json-patch';
import { ServiceRequest } from 'fhir/r4b';
import {
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';

const TELERADIOLOGY_EXTENSION_URLS = [
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
];

export const buildTeleradiologyStripOperations = (serviceRequest: ServiceRequest): Operation[] => {
  const wasSentForFinalRead = serviceRequest.extension?.some(
    (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
  );
  if (!wasSentForFinalRead) {
    return [];
  }

  const remaining = (serviceRequest.extension ?? []).filter((ext) => !TELERADIOLOGY_EXTENSION_URLS.includes(ext.url));

  return remaining.length > 0
    ? [{ op: 'replace', path: '/extension', value: remaining }]
    : [{ op: 'remove', path: '/extension' }];
};
