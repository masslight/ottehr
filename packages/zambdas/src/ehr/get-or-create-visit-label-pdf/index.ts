import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Encounter, Patient, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DYMO_30334_LABEL_CONFIG,
  getMiddleName,
  getPatientFirstName,
  getPatientLastName,
  getPresignedURL,
  getTimezone,
  LabelType,
  MIME_TYPES,
  MimeType,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import {
  createVisitLabel,
  VISIT_LABEL_DOC_TYPE_SYSTEM,
  VISIT_LABEL_PDF_DOC_REF_DOCTYPE,
  VISIT_LABEL_XML_DOC_REF_DOCTYPE,
  VisitLabelConfig,
} from '../../shared/pdf/visit-label-pdf';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'get-or-create-visit-label-pdf';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
        { name: 'type', value: [VISIT_LABEL_PDF_DOC_REF_DOCTYPE.code, VISIT_LABEL_XML_DOC_REF_DOCTYPE.code].join(',') },
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

    const { visitLabelPdf, visitLabelXml } = await createVisitLabel(
      labelConfig,
      encounterId,
      secrets,
      m2mToken,
      oystehr
    );

    //  (LabelPdf|LabelXml)[] return type
    return {
      body: JSON.stringify([visitLabelPdf, visitLabelXml]),
      statusCode: 200,
    };
  } else if (labelDocRefs.length === 1) {
    // this branch covers only pdf labels made before the xml label
    const labelDocRef = labelDocRefs[0];
    console.log(`Found existing DocumentReference/${labelDocRef.id} for Encounter/${encounterId}`);

    return {
      body: JSON.stringify([
        {
          type: getLabelTypeFromDocRef(labelDocRef),
          documentReference: labelDocRef,
          presignedURL: await getPresignedURL(getAttachmentUrlFromDocRef(labelDocRef, MIME_TYPES.PDF), m2mToken),
        },
      ]),
      statusCode: 200,
    };
  } else if (
    labelDocRefs.length === 2 &&
    labelDocRefs.some((dr) => isPdfVisitLabelDocRef(dr)) &&
    labelDocRefs.some((dr) => isXmlVisitLabelDocRef(dr))
  ) {
    const labelPdfDocRef = labelDocRefs.find((docRef) => isPdfVisitLabelDocRef(docRef))!;
    const labelXmlDocRef = labelDocRefs.find((docRef) => isXmlVisitLabelDocRef(docRef))!;
    console.log(
      `label doc ref is DocumentReference/${labelPdfDocRef.id}. xml label doc ref is DocumentReference/${labelXmlDocRef.id}`
    );

    return {
      body: JSON.stringify([
        {
          type: LabelType.label,
          documentReference: labelPdfDocRef,
          presignedURL: await getPresignedURL(getAttachmentUrlFromDocRef(labelPdfDocRef, MIME_TYPES.PDF), m2mToken),
        },
        {
          type: LabelType.xmlLabel,
          documentReference: labelXmlDocRef,
          presignedURL: await getPresignedURL(getAttachmentUrlFromDocRef(labelXmlDocRef, MIME_TYPES.XML), m2mToken),
        },
      ]),
      statusCode: 200,
    };
  }

  throw new Error(`Got ${labelDocRefs.length} docRefs for Encounter/${encounterId}. Expected 0 or 1 or 2`);
});

const isPdfVisitLabelDocRef = (docRef: DocumentReference): boolean => {
  return docRef.type?.coding?.some((coding) => coding.code === VISIT_LABEL_PDF_DOC_REF_DOCTYPE.code) ?? false;
};

const isXmlVisitLabelDocRef = (docRef: DocumentReference): boolean => {
  return docRef.type?.coding?.some((coding) => coding.code === VISIT_LABEL_XML_DOC_REF_DOCTYPE.code) ?? false;
};

const getLabelTypeFromDocRef = (docRef: DocumentReference): LabelType => {
  const type = docRef.type?.coding?.find((coding) => coding.system === VISIT_LABEL_DOC_TYPE_SYSTEM);
  if (!type) throw new Error(`Could not determine label type for DocumentReference/${docRef.id}`);
  if (type.code === LabelType.label) return LabelType.label;
  else if (type.code === LabelType.xmlLabel) return LabelType.xmlLabel;
  throw new Error(`DocumentReference/${docRef.id} has an unexpected label type: ${JSON.stringify(type)}`);
};

const getAttachmentUrlFromDocRef = (docRef: DocumentReference, mimeType: MimeType): string => {
  const url = docRef.content.find((content) => content.attachment.contentType === mimeType)?.attachment.url;

  if (!url) {
    throw new Error(`No url found matching an ${mimeType} for DocumentReference/${docRef.id}`);
  }

  return url;
};
