import { BatchInputPostRequest, SearchParam } from '@zapehr/sdk';
import { DocumentReference, DocumentReferenceContent } from 'fhir/r4';
import { CreateDocumentReferenceInput } from '../../fhir';

export interface FileDocDataForDocReference {
  url: string;
  title: string;
}

export interface CreateFileDocReferenceInput extends Omit<CreateDocumentReferenceInput, 'docInfo' | 'references'> {
  files: FileDocDataForDocReference[];
  referenceParam: { context: DocumentReference['context']; subject?: DocumentReference['subject'] };
  searchParams: SearchParam[];
}

export async function createFilesDocumentReference(
  input: CreateFileDocReferenceInput
): Promise<DocumentReference | null> {
  const { files, type, dateCreated, referenceParam, fhirClient, ottehrModule, searchParams, generateUUID } =
    input;
  try {
    console.log('searching for current document references');
    const docsResponse = fhirClient.searchResources<DocumentReference>({
      resourceType: 'DocumentReference',
      searchParams: [
        {
          name: 'status',
          value: 'current',
        },
        ...searchParams,
      ],
    });

    const docsJson = await docsResponse;

    // Check if files have changed
    if (docsJson.length > 0) {
      const oldDocsTitleUrlConcats = new Set(
        docsJson.flatMap((x) =>
          x.content.map((content) => `${content.attachment.title || ''},${content.attachment.url || ''}`)
        )
      );
      const newDocsTitleUrlConcats = new Set(files.map((x) => `${x.title || ''},${x.url || ''}`));

      console.log("Comparing doc by it's attachment title+ulr pairs");
      const diff = new Set(oldDocsTitleUrlConcats);
      for (const elem of newDocsTitleUrlConcats) {
        if (diff.has(elem)) {
          diff.delete(elem);
        } else {
          diff.add(elem);
        }
      }

      if (diff.size > 0) {
        console.log('Changes in files doc found');
        docsJson.forEach((oldDoc) => {
          fhirClient
            .patchResource({
              resourceType: 'DocumentReference',
              resourceId: oldDoc.id || '',
              operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
            })
            .catch((error) => {
              throw new Error(`Failed to update files doc DocumentReference status: ${JSON.stringify(error)}`);
            });
          console.log(`Files doc DocumentReference ${oldDoc.id} status changed to superseded`);
        });
      } else {
        console.log('No changes in files doc found');
        // assuming that when no diff found there can be only one doc at a time that has same files
        return docsJson[0];
      }
    }
    const content: DocumentReferenceContent[] = [];

    files.forEach((file) => {
      const urlExt = file.url.split('.').slice(-1).toString();
      let contentType: string;
      switch (urlExt) {
        case 'pdf':
          contentType = 'application/pdf';
          break;
        case 'jpg':
          contentType = 'image/jpeg';
          break;
        default:
          contentType = `image/${urlExt}`;
      }
      content.push({
        attachment: {
          url: file.url,
          contentType,
          title: file.title,
        },
      });
    });

    if (content.length > 0) {
      console.log('Creating current files document reference resource');
      const writeDRFullUrl = generateUUID ? generateUUID() : undefined;
      const writeDocRefReq: BatchInputPostRequest = {
        method: 'POST',
        fullUrl: writeDRFullUrl,
        url: '/DocumentReference',
        resource: {
          resourceType: 'DocumentReference',
          meta: {
            tag: [{ code: ottehrModule }],
          },
          status: 'current',
          type: type,
          date: dateCreated,
          content: content,
          ...referenceParam,
        },
      };

      const results = await fhirClient.transactionRequest({ requests: [writeDocRefReq] });
      const docRef = results.entry?.[0]?.resource;
      if (docRef?.resourceType !== 'DocumentReference') {
        throw 'failed';
      }
      return docRef;
    } else {
      console.log('No new document reference created');
      return null;
    }
  } catch (error: unknown) {
    throw new Error(`Failed to create files DocumentReference resource: ${JSON.stringify(error)}`);
  }
}
