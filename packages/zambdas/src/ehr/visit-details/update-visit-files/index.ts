import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Attachment, CodeableConcept, Encounter, List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateDocumentReferenceInput,
  createFilesDocumentReferences,
  EHRImageUploadType,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  INSURANCE_CARD_CODE,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PHOTO_ID_CARD_CODE,
  Secrets,
  SecretsKeys,
  UpdateVisitFilesInput,
  ValidEHRUploadTypes,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'get-visit-files';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const effectInput = await complexValidation(validatedParameters, oystehr);

    const files = await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(files),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const INSURANCE_CARD_TYPE_CODING = {
  coding: [
    {
      system: 'http://loinc.org',
      code: INSURANCE_CARD_CODE,
      display: 'Insurance card front',
    },
  ],
  text: 'Insurance card front',
};

const PHOTO_ID_CARD_TYPE_CODING = {
  coding: [
    {
      system: 'http://loinc.org',
      code: PHOTO_ID_CARD_CODE,
      display: 'Patient data Document',
      text: 'Photo ID cards',
    },
  ],
};

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<void> => {
  // no-op for now
  const { fileType, attachment, patientId, listResources } = input;

  console.log('performEffect called with:', { fileType, attachment, patientId });

  let drType: CodeableConcept;
  if (
    ['insurance-card-front', 'insurance-card-back', 'insurance-card-front-2', 'insurance-card-back-2'].includes(
      fileType
    )
  ) {
    drType = INSURANCE_CARD_TYPE_CODING;
  } else {
    drType = PHOTO_ID_CARD_TYPE_CODING;
  }

  const createDRInput: CreateDocumentReferenceInput = {
    oystehr,
    files: [{ url: attachment.url || '', title: attachment.title || '' }],
    type: drType,
    dateCreated: attachment.creation!,
    searchParams: [{ name: 'patient', value: `Patient/${patientId}` }],
    references: {
      subject: { reference: `Patient/${patientId}` },
      context: { related: [{ reference: `Patient/${patientId}` }] },
    },
    listResources,
  };

  if (fileType === 'insurance-card-front') {
    // do thing
    createDRInput.type = {
      coding: [
        {
          system: 'http://loinc.org',
          code: INSURANCE_CARD_CODE,
          display: 'Insurance card front',
        },
      ],
      text: 'Insurance card front',
    };
  } else if (fileType === 'insurance-card-back') {
    // do other thing
  } else if (fileType === 'insurance-card-front-2') {
    // do another thing
  } else if (fileType === 'insurance-card-back-2') {
    // do yet another thing
  } else if (fileType === 'photo-id-front') {
    // do different thing altogether
  } else if (fileType === 'photo-id-back') {
    // do something else
  } else {
    throw new Error('unhandled fileType in performEffect');
  }

  const { docRefs } = await createFilesDocumentReferences(createDRInput);

  console.log('Created DocumentReferences:', JSON.stringify(docRefs, null, 2));

  return;
};

interface EffectInput extends Omit<Input, 'appointmentId' | 'patientId'> {
  patientId: string;
  listResources: List[];
}

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<EffectInput> => {
  const { appointmentId, patientId } = input;

  let resourceType: 'Appointment' | 'Patient';
  const params: SearchParam[] = [];

  if (appointmentId) {
    resourceType = 'Appointment';
    params.push({ name: '_id', value: appointmentId });
    params.push({ name: '_include', value: 'Appointment:patient' });
  } else if (patientId) {
    resourceType = 'Patient';
    params.push({ name: '_id', value: patientId });
  } else {
    throw new Error('Either appointmentId or patientId must be provided');
  }
  const patient = await oystehr.fhir.search<Appointment | Patient | Encounter>({
    resourceType,
    params,
  });
  const patientResource = patient.entry?.find((entry) => entry.resource?.resourceType === 'Patient')
    ?.resource as Patient;

  const confirmedPatientId = patientResource?.id;

  if (!confirmedPatientId) {
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }

  // todo: should be able to narrow the search based on the the document type being requested
  // notes to a potential future brave refactorer:
  // the shared abstraction for creating document references is a bit funny and says I need to include the existing list
  // of List resources, so I'm including it. it has the necessary input to go get those resources and also already does additional querying
  // to get the analogous document references using passed in params, so it's straddling a couple of different possible api designs here.
  // it looks like it is just being pulled too many different ways in service to different use cases. strong "wrong abstraction" smells.
  const listResources = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'patient', value: `Patient/${confirmedPatientId}` }],
    })
  ).unbundle();

  return {
    ...input,
    patientId: confirmedPatientId,
    listResources,
  };
};

interface Input extends UpdateVisitFilesInput {
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const {
    fileType: maybeFileType,
    attachment: maybeAttachment,
    patientId: maybePatientId,
    appointmentId: maybeAppointmentId,
  } = JSON.parse(input.body);

  const missingParams: string[] = [];

  if (!maybeFileType) {
    missingParams.push('fileType');
  }
  if (!maybeAttachment) {
    missingParams.push('attachment');
  }

  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }

  console.log('checking fileType validity', maybeFileType, ValidEHRUploadTypes);

  if (typeof maybeFileType !== 'string' || !ValidEHRUploadTypes.includes(maybeFileType as any)) {
    throw INVALID_INPUT_ERROR(`"fileType" is invalid. must be one of ${ValidEHRUploadTypes.join(', ')}`);
  }
  // todo: avoid "as"
  const fileType = maybeFileType as EHRImageUploadType;

  const invalidAttachmentShapeMessage = `"attachment" must be an object with "url", "title", and "creation" fields`;
  if (typeof maybeAttachment !== 'object') {
    throw INVALID_INPUT_ERROR(invalidAttachmentShapeMessage);
  }
  const attachmentKeys = new Set(Object.keys(maybeAttachment));
  if (!attachmentKeys.has('url') || !attachmentKeys.has('title') || !attachmentKeys.has('creation')) {
    throw INVALID_INPUT_ERROR(invalidAttachmentShapeMessage);
  }

  if (!maybeAttachment.url || typeof maybeAttachment.url !== 'string') {
    throw INVALID_INPUT_ERROR(`"attachment.url" must be a non-empty string.`);
  }

  if (!maybeAttachment.title || typeof maybeAttachment.title !== 'string') {
    throw INVALID_INPUT_ERROR(`"attachment.title" must be a non-empty string.`);
  }

  if (
    !maybeAttachment.creation ||
    typeof maybeAttachment.creation !== 'string' ||
    !DateTime.fromISO(maybeAttachment.creation).isValid
  ) {
    throw INVALID_INPUT_ERROR(`"attachment.creation" must be a valid ISO date string.`);
  }

  if (!maybePatientId && !maybeAppointmentId) {
    throw INVALID_INPUT_ERROR(`Either "patientId" or "appointmentId" must be provided.`);
  }

  if (maybePatientId && typeof maybePatientId !== 'string') {
    throw INVALID_INPUT_ERROR(`"patientId" must be a string.`);
  }

  if (maybeAppointmentId && typeof maybeAppointmentId !== 'string') {
    throw INVALID_INPUT_ERROR(`"appointmentId" must be a string.`);
  }

  if (maybePatientId && isValidUUID(maybePatientId) === false) {
    throw INVALID_INPUT_ERROR('"patientId" must be a valid UUID.');
  }

  if (maybeAppointmentId && isValidUUID(maybeAppointmentId) === false) {
    throw INVALID_INPUT_ERROR('"appointmentId" must be a valid UUID.');
  }

  const patientId = maybePatientId as string;
  const appointmentId = maybeAppointmentId as string;

  // todo: avoid "as"
  const attachment = maybeAttachment as Attachment;
  return {
    secrets,
    fileType,
    attachment,
    patientId,
    appointmentId: patientId ? undefined : appointmentId,
  };
};
