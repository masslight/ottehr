import { BatchInputPostRequest, SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Attachment, DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { addOperation, replaceOperation } from 'utils';
import { CreateDocumentReferenceInput, findExistingListByDocumentTypeCode, OTTEHR_MODULE } from '../../fhir';

export interface FileDocDataForDocReference {
  url: string;
  title: string;
}

export interface CreateFileDocReferenceInput extends Omit<CreateDocumentReferenceInput, 'docInfo' | 'references'> {
  files: FileDocDataForDocReference[];
  referenceParam?: { subject?: DocumentReference['subject']; context?: DocumentReference['context'] };
  searchParams: SearchParam[];
  listResources?: List[];
}

export async function createFilesDocumentReferences(input: CreateFileDocReferenceInput): Promise<DocumentReference[]> {
  const { files, type, dateCreated, referenceParam, oystehr, searchParams, generateUUID, listResources } = input;
  console.log('files for doc refs', JSON.stringify(files));
  try {
    console.log('searching for current document references', JSON.stringify(searchParams));
    const docsJson = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          {
            name: 'status',
            value: 'current',
          },
          ...searchParams,
        ],
      })
    ).unbundle();

    const results: DocumentReference[] = [];
    // Track new entries by list type code
    const newEntriesByType: Record<string, Array<{ date: string; item: { type: string; reference: string } }>> = {};

    for (const file of files) {
      // Check if there's an existing DocumentReference for this file
      const existingDoc = docsJson.find(
        (doc) => doc.content[0]?.attachment.title === file.title && doc.content[0]?.attachment.url === file.url
      );

      if (existingDoc) {
        // If exact same file exists, reuse it
        results.push(existingDoc);
        continue;
      }
      // If different version exists, mark it as superseded
      const oldDoc = docsJson.find((doc) => doc.content[0]?.attachment.title === file.title);
      if (oldDoc) {
        await oystehr.fhir.patch({
          resourceType: 'DocumentReference',
          id: oldDoc.id || '',
          operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
        });
      }

      // Create all DocumentReferences
      const urlExt = file.url.split('.').slice(-1).toString();
      const contentType = urlExt === 'pdf' ? 'application/pdf' : urlExt === 'jpg' ? 'image/jpeg' : `image/${urlExt}`;

      const writeDRFullUrl = generateUUID ? generateUUID() : undefined;

      const writeDocRefReq: BatchInputPostRequest<DocumentReference> = {
        method: 'POST',
        fullUrl: writeDRFullUrl,
        url: '/DocumentReference',
        resource: {
          resourceType: 'DocumentReference',
          meta: {
            // for backward compatibility. TODO: remove this
            tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
          },
          status: 'current',
          type: type,
          date: dateCreated,
          content: [
            {
              attachment: {
                url: file.url,
                contentType,
                title: file.title,
              },
            },
          ],
          ...referenceParam,
        },
      };

      console.log('making DocumentReference ...');
      const docRefBundle = await oystehr.fhir.transaction<DocumentReference>({
        requests: [writeDocRefReq],
      });
      console.log(`making DocumentReference results => `);
      console.log(JSON.stringify(docRefBundle));
      const docRef = docRefBundle.entry?.[0]?.resource;
      // Collect document reference to list by type
      if (listResources && type.coding?.[0]?.code && docRef) {
        const typeCode = type.coding[0].code;
        if (!newEntriesByType[typeCode]) {
          newEntriesByType[typeCode] = [];
        }
        newEntriesByType[typeCode].push({
          date: DateTime.now().setZone('UTC').toISO() ?? '',
          item: {
            type: 'DocumentReference',
            reference: `DocumentReference/${docRef.id}`,
          },
        });
        results.push(docRef);
      }
    }

    // Update lists
    if (listResources) {
      for (const [typeCode, newEntries] of Object.entries(newEntriesByType)) {
        const list = findExistingListByDocumentTypeCode(listResources, typeCode);
        if (!list?.id) {
          console.log(`default list for files with typeCode: ${typeCode} not found. Add typeCode to FOLDERS_CONFIG`);
        } else {
          const updatedFolderEntries = [...(list?.entry ?? []), ...newEntries];
          const patchListWithDocRefOperation: Operation =
            list?.entry && list.entry?.length > 0
              ? replaceOperation('/entry', updatedFolderEntries)
              : addOperation('/entry', updatedFolderEntries);
          console.log('operation:', JSON.stringify(patchListWithDocRefOperation));

          console.log(`patching documents folder List ...`);

          const listPatchResult = await oystehr.fhir.patch<List>({
            resourceType: 'List',
            id: list?.id ?? '',
            operations: [patchListWithDocRefOperation],
          });

          console.log(`patch results => `);
          console.log(JSON.stringify(listPatchResult));
        }
      }
    }

    return results;
  } catch (error: unknown) {
    console.log('Error writing doc refs', JSON.stringify(error));
    throw new Error(`Failed to create files DocumentReference resource: ${JSON.stringify(error)}`);
  }
}

export const addContentTypeToAttachement = (attachment: Attachment): Attachment => {
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
