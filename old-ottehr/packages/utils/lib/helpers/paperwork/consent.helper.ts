import { FhirClient } from '@zapehr/sdk';
import { Consent, DocumentReference, Patient, QuestionnaireResponse } from 'fhir/r4';
import { OTTEHR_MODULE } from '../../fhir';
import { Secrets } from '../../secrets';
import { ConsentSigner, PaperworkResponse } from '../../types';

export async function checkAndCreateConsent(
  questionnaireResponseResource: QuestionnaireResponse | undefined,
  paperwork: PaperworkResponse[],
  patientResource: Patient,
  appointmentID: string,
  locationID: string,
  createdDate: string,
  ipAddress: string,
  fhirClient: FhirClient,
  secrets: Secrets | null,
  token: string,
  ottehrModule: OTTEHR_MODULE,
  createConsentItems: (
    dateTime: string,
    patient: Patient,
    consentSigner: ConsentSigner,
    appointmentID: string,
    locationID: string,
    ipAddress: string,
    fhirClient: FhirClient,
    token: string,
    secrets: Secrets | null,
    ottehrModule: OTTEHR_MODULE,
    timezone?: string
  ) => Promise<void>,
  timezone?: string
): Promise<void> {
  console.log('Checking DocumentReferences for consent forms');
  const oldConsentResponse = {
    signature: questionnaireResponseResource?.item?.find((response) => response.linkId === 'signature')?.answer?.[0]
      .valueString,
    fullName: questionnaireResponseResource?.item?.find((response) => response.linkId === 'full-name')?.answer?.[0]
      .valueString,
    relationship: questionnaireResponseResource?.item?.find(
      (response) => response.linkId === 'consent-form-signer-relationship'
    )?.answer?.[0].valueString,
  };

  const newConsentResponse = {
    signature: paperwork.find((question) => question.linkId === 'signature')?.response,
    fullName: paperwork.find((question) => question.linkId === 'full-name')?.response,
    relationship: paperwork.find((question) => question.linkId === 'consent-form-signer-relationship')?.response,
  };

  // Search for existing consent DocumentReferences for the appointment
  let oldConsentDocRefs: DocumentReference[] | undefined = undefined;
  let oldConsentResources: Consent[] | undefined = undefined;
  if (questionnaireResponseResource) {
    oldConsentDocRefs = await fhirClient.searchResources<DocumentReference>({
      resourceType: 'DocumentReference',
      searchParams: [
        {
          name: 'status',
          value: 'current',
        },
        {
          name: 'type',
          value: '59284-0',
        },
        {
          name: 'subject',
          value: `Patient/${patientResource.id}`,
        },
        {
          name: 'related',
          value: `Appointment/${appointmentID}`,
        },
      ],
    });

    oldConsentResources = await fhirClient.searchResources<Consent>({
      resourceType: 'Consent',
      searchParams: [
        { name: 'patient', value: `Patient/${patientResource.id}` },
        { name: 'status', value: 'active' },
      ],
    });
  }

  // Create consent PDF, DocumentReference, and Consent resource if there are none or signer information changes
  if (
    !oldConsentDocRefs?.length ||
    !oldConsentResources?.length ||
    oldConsentResponse.signature !== newConsentResponse.signature ||
    oldConsentResponse.fullName !== newConsentResponse.fullName ||
    oldConsentResponse.relationship !== newConsentResponse.relationship
  ) {
    await createConsentItems(
      createdDate,
      patientResource,
      {
        signature: newConsentResponse.signature,
        fullName: newConsentResponse.fullName,
        relationship: newConsentResponse.relationship,
      },
      appointmentID,
      locationID,
      ipAddress,
      fhirClient,
      token,
      secrets,
      ottehrModule,
      timezone
    );

    // Update prior consent DocumentReferences statuses to superseded
    if (oldConsentDocRefs?.length) {
      for (const oldDocRef of oldConsentDocRefs) {
        await fhirClient
          .patchResource({
            resourceType: 'DocumentReference',
            resourceId: oldDocRef.id || '',
            operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
          })
          .catch((error) => {
            throw new Error(`Failed to update DocumentReference ${oldDocRef.id} status: ${JSON.stringify(error)}`);
          });
        console.log(`DocumentReference ${oldDocRef.id} status changed to superseded`);
      }
    }

    // Update prior Consent resource statuses to inactive
    if (oldConsentResources?.length) {
      for (const oldConsentResource of oldConsentResources || []) {
        await fhirClient
          .patchResource({
            resourceType: 'Consent',
            resourceId: oldConsentResource.id || '',
            operations: [
              {
                op: 'replace',
                path: '/status',
                value: 'inactive',
              },
            ],
          })
          .catch((error) => {
            throw new Error(`Failed to update Consent ${oldConsentResource.id} status: ${JSON.stringify(error)}`);
          });
        console.log(`Consent ${oldConsentResource.id} status changed to inactive`);
      }
    }
  } else {
    console.log('No changes to consent');
  }
}
