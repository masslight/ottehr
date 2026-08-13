import { BatchInputPatchRequest } from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { addOrReplaceOperation } from 'utils/lib/helpers/operations';
import { SCHOOL_WORK_NOTE_TYPE_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { SCHOOL_NOTE_CODE, WORK_NOTE_CODE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { isDocumentPublished, PdfDocumentReferencePublishedStatuses } from './pdf/pdf-utils';

export function createPublishExcuseNotesOps(
  documentReferences: DocumentReference[],
  encounterId: string
): BatchInputPatchRequest<DocumentReference>[] {
  const encounterRef = `Encounter/${encounterId}`;
  const resultBatchRequests: BatchInputPatchRequest<DocumentReference>[] = [];
  let workNoteDR: DocumentReference | undefined;
  let schoolNoteDR: DocumentReference | undefined;
  documentReferences.forEach((item) => {
    if (!item.context?.encounter?.some((ref) => ref.reference === encounterRef)) return;
    const workSchoolNoteTag = item.meta?.tag?.find((tag) => tag.system === SCHOOL_WORK_NOTE_TYPE_META_SYSTEM);
    if (workSchoolNoteTag) {
      if (workSchoolNoteTag.code === SCHOOL_NOTE_CODE) schoolNoteDR = item;
      if (workSchoolNoteTag.code === WORK_NOTE_CODE) workNoteDR = item;
    }
  });
  if (workNoteDR && !isDocumentPublished(workNoteDR)) {
    resultBatchRequests.push(pdfPublishedPatchOperation(workNoteDR));
  }
  if (schoolNoteDR && !isDocumentPublished(schoolNoteDR)) {
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
