import { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, PATIENT_EDUCATION_DOC_TYPE_CODE } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { createPatientEducationPdf } from '../../shared/pdf/patient-education-pdf';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'save-patient-education-pdf',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      console.log('save-patient-education-pdf started');

      const { encounterId, patientId, sections, title, secrets } = validateRequestParameters(input);
      console.log('Validated params:', { encounterId, patientId, title, sectionCount: sections.length });

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const pdfBytes = await createPatientEducationPdf(sections);
      console.log('Rendered PDF bytes:', pdfBytes.length);

      const z3Url = makeZ3Url({
        secrets,
        bucketName: BUCKET_NAMES.PATIENT_EDUCATION,
        patientID: patientId,
        fileName: 'PatientEducation.pdf',
      });
      const presignedUploadUrl = await createPresignedUrl(m2mToken, z3Url, 'upload');
      await uploadObjectToZ3(pdfBytes, presignedUploadUrl);
      console.log('Uploaded patient education PDF to Z3');

      // Return a download URL alongside the DocumentReference so the UI can open the newly
      // approved PDF without a second round-trip (DocumentReference fetch + presign).
      const presignedDownloadUrl = await createPresignedUrl(m2mToken, z3Url, 'download');

      const docRefRequest: BatchInputPostRequest<DocumentReference> = {
        method: 'POST',
        fullUrl: randomUUID(),
        url: '/DocumentReference',
        resource: {
          resourceType: 'DocumentReference',
          status: 'current',
          type: {
            coding: [
              {
                system: 'https://fhir.ottehr.com/CodeSystem/document-type',
                code: PATIENT_EDUCATION_DOC_TYPE_CODE,
                display: 'Patient Education',
              },
            ],
          },
          date: DateTime.now().setZone('UTC').toISO() ?? '',
          subject: { reference: `Patient/${patientId}` },
          context: {
            encounter: [{ reference: `Encounter/${encounterId}` }],
          },
          content: [
            {
              attachment: {
                url: z3Url,
                contentType: 'application/pdf',
                title,
              },
            },
          ],
        },
      };

      const result = await oystehr.fhir.transaction<DocumentReference>({
        requests: [docRefRequest],
      });

      const docRef = result.entry?.[0]?.resource;
      if (!docRef?.id) {
        throw new Error('Failed to create DocumentReference for patient education PDF');
      }

      console.log(`Created DocumentReference ${docRef.id} for patient education PDF`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          documentReferenceId: docRef.id,
          presignedDownloadUrl,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('save-patient-education-pdf error:', message, error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: message }),
      };
    }
  }
);
