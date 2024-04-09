import { FhirClient, SearchParam } from '@zapehr/sdk';
import { CodeableConcept, DocumentReference, DocumentReferenceContent } from 'fhir/r4';
import { OTTEHR_MODULE } from '../../fhir';

export async function createCardsDocumentReference(
  cardFrontUrl: string | undefined,
  cardBackUrl: string | undefined,
  cardFrontTitle: string,
  cardBackTitle: string,
  type: CodeableConcept,
  dateCreated: string,
  referenceParam: object,
  searchParams: SearchParam[],
  fhirClient: FhirClient
): Promise<DocumentReference | null> {
  try {
    console.log('searching for current document reference');
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

    // Check if cards have changed
    if (docsJson.length > 0) {
      let currentCardsIndex = null;
      const docsUpdated = docsJson.map((oldDoc, index) => {
        const frontIndex = oldDoc.content.findIndex((card) => card.attachment.title === cardFrontTitle);
        const backIndex = oldDoc.content.findIndex((card) => card.attachment.title === cardBackTitle);
        const frontUpdated = oldDoc.content?.[frontIndex]?.attachment?.url !== (cardFrontUrl || undefined);
        const backUpdated = oldDoc.content?.[backIndex]?.attachment?.url !== (cardBackUrl || undefined);

        if (frontUpdated || backUpdated) {
          console.log('card document reference is changing');
          fhirClient
            .patchResource({
              resourceType: 'DocumentReference',
              resourceId: oldDoc.id || '',
              operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
            })
            .catch((error) => {
              throw new Error(`Failed to update card DocumentReference status: ${JSON.stringify(error)}`);
            });
          console.log(`Card DocumentReference ${oldDoc.id} status changed to superseded`);
          return true;
        } else {
          console.log('No change in cards');
          currentCardsIndex = index;
          return false;
        }
      });

      if (docsUpdated.includes(false) && currentCardsIndex !== null) {
        return docsJson[currentCardsIndex];
      }
    }

    const content: DocumentReferenceContent[] = [];

    if (cardFrontUrl) {
      const urlExt = cardFrontUrl.split('.').slice(-1).toString();
      content.push({
        attachment: {
          url: cardFrontUrl,
          contentType: `image/${urlExt === 'jpg' ? 'jpeg' : urlExt}`,
          title: cardFrontTitle,
        },
      });
    }

    if (cardBackUrl) {
      const urlExt = cardBackUrl.split('.').slice(-1).toString();
      content.push({
        attachment: {
          url: cardBackUrl,
          contentType: `image/${urlExt === 'jpg' ? 'jpeg' : urlExt}`,
          title: cardBackTitle,
        },
      });
    }

    if (content.length > 0) {
      console.log('creating current card document reference resource');
      const response = fhirClient.createResource<DocumentReference>({
        resourceType: 'DocumentReference',
        meta: {
          tag: [{ code: OTTEHR_MODULE.UC }],
        },
        status: 'current',
        type: type,
        date: dateCreated,
        content: content,
        ...referenceParam,
      });
      const json = await response;
      return json;
    } else {
      console.log('no new document reference created');
      return null;
    }
  } catch (error: unknown) {
    throw new Error(`Failed to create cards DocumentReference resource: ${JSON.stringify(error)}`);
  }
}
