import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Encounter, Patient, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DYMO_30334_LABEL_CONFIG,
  getMiddleName,
  getPatientFirstName,
  getPatientLastName,
  getPresignedURL,
  getSecret,
  getTimezone,
  MIME_TYPES,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createVisitLabelPDF, VISIT_LABEL_DOC_REF_DOCTYPE, VisitLabelConfig } from '../../shared/pdf/visit-label-pdf';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'get-or-create-visit-label-pdf';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { encounterId, secrets } = validateRequestParameters(input);

    console.log('Getting token');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    console.log('token', m2mToken);

    const oystehr = createOystehrClient(m2mToken, secrets);

    const labelDocRefs = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'encounter', value: `Encounter/${encounterId}` },
          { name: 'status', value: 'current' },
          { name: 'type', value: VISIT_LABEL_DOC_REF_DOCTYPE.code },
        ],
      })
    ).unbundle();

    if (!labelDocRefs.length) {
      // we should create the pdf. Need patient & appointment info
      console.log(`No docRefs found for Encounter/${encounterId}. Making new label`);
      const resources = (
        await oystehr.fhir.search<Encounter | Patient | Appointment | Slot | Schedule>({
          resourceType: 'Encounter',
          params: [
            {
              name: '_id',
              value: encounterId!,
            },
            {
              name: '_include',
              value: 'Encounter:subject',
            },
            {
              name: '_include',
              value: 'Encounter:appointment',
            },
            {
              name: '_include:iterate',
              value: 'Appointment:slot',
            },
            {
              name: '_include:iterate',
              value: 'Slot:schedule',
            },
          ],
        })
      ).unbundle();

      const { patients, appointments, schedules } = resources.reduce(
        (acc, res) => {
          if (res.resourceType === 'Patient') acc.patients.push(res);
          if (res.resourceType === 'Appointment') acc.appointments.push(res);
          if (res.resourceType === 'Schedule') acc.schedules.push(res);
          return acc;
        },
        { patients: [], appointments: [], schedules: [] } as {
          patients: Patient[];
          appointments: Appointment[];
          schedules: Schedule[];
        }
      );

      if (patients.length !== 1 || appointments.length !== 1) {
        throw new Error(`Error fetching patient, encounter, or appointment for Encounter/${encounterId}`);
      }

      const patient = patients[0];

      const labelConfig: VisitLabelConfig = {
        labelConfig: DYMO_30334_LABEL_CONFIG,
        content: {
          patientId: patient.id!,
          patientFirstName: getPatientFirstName(patient) ?? '',
          patientMiddleName: getMiddleName(patient),
          patientLastName: getPatientLastName(patient) ?? '',
          patientDateOfBirth: patient.birthDate ? DateTime.fromISO(patient.birthDate) : undefined,
          patientGender: patient.gender ?? '',
          visitDate: appointments[0].start ? DateTime.fromISO(appointments[0].start) : undefined,
          visitTimeZone: schedules[0] ? getTimezone(schedules[0]) : undefined,
        },
      };

      const { presignedURL, docRef: documentReference } = await createVisitLabelPDF(
        labelConfig,
        encounterId,
        secrets,
        m2mToken,
        oystehr
      );

      //  LabelPdf[] return type
      return {
        body: JSON.stringify([{ documentReference, presignedURL }]),
        statusCode: 200,
      };
    } else if (labelDocRefs.length === 1) {
      const labelDocRef = labelDocRefs[0];
      console.log(`Found existing DocumentReference/${labelDocRef.id} for Encounter/${encounterId}`);
      const url = labelDocRef.content.find((content) => content.attachment.contentType === MIME_TYPES.PDF)?.attachment
        .url;

      if (!url) {
        throw new Error(`No url found matching an application/pdf for DocumentReference/${labelDocRef.id}`);
      }

      return {
        body: JSON.stringify([
          {
            documentReference: labelDocRef,
            presignedURL: await getPresignedURL(url, m2mToken),
          },
        ]),
        statusCode: 200,
      };
    }

    throw new Error(`Got ${labelDocRefs.length} docRefs for Encounter/${encounterId}. Expected 0 or 1`);
  } catch (error: any) {
    console.error('get or create visit label pdf error:', JSON.stringify(error));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-get-or-create-visit-label-pdf', error, ENVIRONMENT);
  }
});
