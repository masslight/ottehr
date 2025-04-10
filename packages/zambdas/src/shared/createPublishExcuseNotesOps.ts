import { BatchInputPatchRequest } from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import {
  addOrReplaceOperation,
  getPatchBinary,
  SCHOOL_NOTE_CODE,
  SCHOOL_WORK_NOTE_TYPE_META_SYSTEM,
  WORK_NOTE_CODE,
} from 'utils';
import { PdfDocumentReferencePublishedStatuses } from './pdf/pdf-utils';

export function createPublishExcuseNotesOps(
  documentReferences: DocumentReference[]
): BatchInputPatchRequest<DocumentReference>[] {
  const resultBatchRequests: BatchInputPatchRequest<DocumentReference>[] = [];
  let workNoteDR: DocumentReference | undefined;
  let schoolNoteDR: DocumentReference | undefined;
  documentReferences.forEach((item) => {
    const workSchoolNoteTag = item.meta?.tag?.find((tag) => tag.system === SCHOOL_WORK_NOTE_TYPE_META_SYSTEM);
    if (workSchoolNoteTag) {
      if (workSchoolNoteTag.code === SCHOOL_NOTE_CODE) schoolNoteDR = item;
      if (workSchoolNoteTag.code === WORK_NOTE_CODE) workNoteDR = item;
    }
  });
  if (workNoteDR && workNoteDR.docStatus !== PdfDocumentReferencePublishedStatuses.published) {
    resultBatchRequests.push(pdfPublishedPatchOperation(workNoteDR));
  }
  if (schoolNoteDR && schoolNoteDR.docStatus !== PdfDocumentReferencePublishedStatuses.published) {
    resultBatchRequests.push(pdfPublishedPatchOperation(schoolNoteDR));
  }
  return resultBatchRequests;
}

function pdfPublishedPatchOperation(documentReference: DocumentReference): BatchInputPatchRequest<DocumentReference> {
  return getPatchBinary({
    resourceType: 'DocumentReference',
    resourceId: documentReference.id!,
    patchOperations: [
      addOrReplaceOperation(documentReference.docStatus, '/docStatus', PdfDocumentReferencePublishedStatuses.published),
    ],
  });
}
