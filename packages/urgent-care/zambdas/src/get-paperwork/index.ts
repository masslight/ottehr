/* eslint-disable @typescript-eslint/no-unused-vars */
import { FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  DocumentReference,
  Location,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from 'fhir/r4';
import { AvailableLocationInformation } from '../get-location';
import { getAccessToken } from '../shared';
import { getUser, userHasAccessToPatient } from '../shared/auth';
import { getAppointmentResource, getQuestionnaireResponse, getRecentQuestionnaireResponse } from '../shared/fhir';
import { getEncounterForAppointment } from '../shared/getEncounterDetails';
import { createFhirClient } from '../shared/helpers';
import { FileURLs, FormItemType, PaperworkPage, Question, QuestionOperator, VisitType } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import { Secrets, ZambdaInput, topLevelCatch } from 'utils';

export interface GetPaperworkInput {
  appointmentID: string; // passed for appointment visits
  secrets: Secrets | null;
  authorization: string | undefined;
}

interface PaperworkResponseWithoutResponses {
  message: string;
  appointment: {
    start: string;
    location: AvailableLocationInformation;
    visitType: VisitType;
    status?: string;
  };
  questions: PaperworkPage[];
  paperworkCompleteOrInProgress: boolean;
}

type PaperworkResponseWithResponses = PaperworkResponseWithoutResponses & {
  paperwork: any;
  files?: FileURLs;
};

export function questionnaireItemToInputType(item: QuestionnaireItem): Question {
  const questionItemType = item.type;
  let formItemType: FormItemType = undefined;

  const attributes = item.extension?.map((extensionTemp) => ({
    name: extensionTemp.url.replace('https://fhir.zapehr.com/r4/StructureDefinitions/', ''),
    value: extensionTemp.valueString || extensionTemp.valueBoolean || extensionTemp.valuePositiveInt,
  }));
  let multiline = false;

  if (questionItemType === 'string') {
    formItemType = 'Text';
    // const inputType = item.extension?.find(
    //   (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/input-type'
    // )?.valueString;
  } else if (questionItemType === 'choice') {
    formItemType = 'Select';
    if (attributes?.find((attributeTemp) => attributeTemp.name === 'select-type' && attributeTemp.value === 'Radio')) {
      formItemType = 'Radio';
    }
    if (
      attributes?.find((attributeTemp) => attributeTemp.name === 'select-type' && attributeTemp.value == 'Radio List')
    ) {
      formItemType = 'Radio List';
    }
  } else if (questionItemType === 'display') {
    const textType = item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
    )?.valueString;
    if (textType === 'h3') {
      formItemType = 'Header 3';
    } else if (textType === 'p') {
      formItemType = 'Description';
    }
  } else if (questionItemType === 'date') {
    formItemType = 'Date';
  } else if (questionItemType === 'text') {
    formItemType = 'Text';
    multiline = true;
  } else if (questionItemType === 'attachment') {
    formItemType = 'File';
  } else if (questionItemType === 'boolean') {
    formItemType = 'Checkbox';
  }

  const enableWhen = item.enableWhen;
  const enableWhenQuestion = item.enableWhen?.[0].question;
  const enableWhenOperator = item.enableWhen?.[0].operator;
  const enableWhenAnswer = item.enableWhen?.[0].answerString;

  const requireWhen = item.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
  )?.extension;
  const requireWhenQuestion = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
  )?.valueString;
  const requireWhenOperator: QuestionOperator = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
  )?.valueString as QuestionOperator;
  const requireWhenAnswer = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
  )?.valueString;

  const minRows = attributes?.find((attributeTemp) => attributeTemp.name === 'input-multiline-minimum-rows')
    ?.value as number;

  return {
    id: item.linkId,
    text: item.text || 'Unknown',
    type: formItemType,
    multiline,
    minRows,
    placeholder: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/placeholder',
    )?.valueString,
    infoText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text',
    )?.valueString,
    infoTextSecondary: item.extension?.find(
      (extensionTemp) =>
        extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary',
    )?.valueString,
    required: item.required,
    width: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
    )?.valuePositiveInt,
    options: item.answerOption?.map((option) => option.valueString || 'Unknown'),
    attachmentText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
    )?.valueString,
    format: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
    )?.valueString,
    docType: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
    )?.valueString,
    enableWhen: enableWhen
      ? {
          question: enableWhenQuestion || 'Unknown',
          operator: enableWhenOperator,
          answer: enableWhenAnswer || 'Unknown',
        }
      : undefined,
    requireWhen: requireWhen
      ? {
          question: requireWhenQuestion || 'Unknown',
          operator: requireWhenOperator,
          answer: requireWhenAnswer || 'Unknown',
        }
      : undefined,
  };
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, secrets, authorization } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken, secrets);
    // const z3Client = createZ3Client(zapehrToken, secrets);
    // const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);

    let appointment: Appointment | undefined = undefined;
    let location: Location | undefined = undefined;

    const questionnaireSearch: Questionnaire[] = await fhirClient.searchResources({
      resourceType: 'Questionnaire',
      searchParams: [
        {
          name: 'name',
          value: 'paperwork',
        },
      ],
    });

    // if we do not get exactly one result, throw an error
    if (questionnaireSearch.length < 1) {
      throw new Error('Could not find questionnaire with provided name');
    } else if (questionnaireSearch.length > 1) {
      throw new Error('Found multiple questionnaires with the provided name');
    }

    // otherwise, take the one result
    const questionnaire: Questionnaire = questionnaireSearch[0];
    if (!questionnaire.id) {
      throw new Error('Questionnaire ID is undefined');
    }
    if (!questionnaire.item) {
      questionnaire.item = [];
    }
    let paperworkPages: PaperworkPage[] = questionnaire.item.map((questionPage) => {
      const page = questionPage.text;
      const items = questionPage.item || [];
      const reviewPageName = questionPage.extension?.find(
        (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/review-text',
      )?.valueString;

      return {
        page: page || 'Unknown',
        reviewPageName: reviewPageName,
        slug: questionPage.linkId.replace('-page', ''),
        questions: items.map((item) => questionnaireItemToInputType(item)),
      };
    });

    // paperworkComplete means the paperwork has been completed
    let paperworkComplete = false;
    // paperworkFilledOutForAppointment means the paperwork has been filled out for this
    // appointment -- it does not mean the paperwork has been completed
    let paperworkFilledOutForAppointment = false;
    let questionnaireResponseResource: QuestionnaireResponse | undefined = undefined;
    let appointmentPatient = undefined;

    // only prebooked appointments will have an appointment id
    console.log(`getting appointment resource for id ${appointmentID}`);
    appointment = await getAppointmentResource(appointmentID, fhirClient);
    if (!appointment) {
      console.log('Appointment is not found');
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Appointment is not found' }),
      };
    }
    const locationId = appointment.participant
      .find((appt) => appt.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.replace('Location/', '');
    if (!appointment.start || !locationId) {
      throw new Error('Error getting appointment start time or location details');
    }
    appointmentPatient = appointment.participant
      .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
      ?.actor?.reference?.replace('Patient/', '');
    if (!appointmentPatient) {
      throw new Error('appointmentPatient is not defined');
    }
    console.log(`getting location resource where id is ${locationId}`);
    location = (await fhirClient.readResource({ resourceType: 'Location', resourceId: locationId })) as Location;

    const encounter = await getEncounterForAppointment(appointment.id || 'Unknown', fhirClient);
    if (!encounter.id) {
      throw new Error('Encounter ID is undefined');
    }

    console.log(
      `Getting a QuestionnaireResponse for appointment ${appointmentID} questionnaire ${questionnaire.id} encounter ${encounter.id}`,
    );
    questionnaireResponseResource = await getQuestionnaireResponse(questionnaire.id, encounter.id, fhirClient);
    if (questionnaireResponseResource) {
      paperworkFilledOutForAppointment = true;
    }

    // If it's a search by patient ID, it is for a new appointment so we should
    // not return consent information pre-checked
    const itemsNotToPrefill: string[] = ['patient-point-of-discovery'];
    if (!paperworkFilledOutForAppointment) {
      itemsNotToPrefill.push(
        ...['consent-form-signer-relationship', 'consent-to-treat', 'full-name', 'hipaa-acknowledgement', 'signature'],
      );
    }

    let responses: any = {};
    if (questionnaireResponseResource && questionnaireResponseResource.item) {
      responses = await updateQuestionnaireResponseItems(questionnaireResponseResource.item, itemsNotToPrefill);
      paperworkComplete =
        questionnaireResponseResource.status === 'completed' || questionnaireResponseResource.status === 'amended';
    }

    console.log('checking user authorization');
    // Do not return paperwork information if user is not logged in
    if (!authorization) {
      console.log('User is not authorized');
      const response = getPaperworkForUserWithoutAccess(
        paperworkComplete,
        paperworkFilledOutForAppointment,
        appointment,
        paperworkPages,
        location,
      );
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    console.log('getting user');
    const user = await getUser(authorization.replace('Bearer ', ''), secrets);

    // If it's a returning patient, check if the user has
    // access to the patient and the appointment.
    // If the user does not have access to either,
    // do not return paperwork information.
    // todo: this endpoint currently takes patient ID
    // and appointment ID, but it might not need to take
    // one of them, so we need to update the check here.
    console.log('checking user access to patient');
    const userAccess = await userHasAccessToPatient(user, appointmentPatient, fhirClient);
    if (!userAccess) {
      console.log('User is authorized without permission to access this appointment');
      const response = getPaperworkForUserWithoutAccess(
        paperworkComplete,
        paperworkFilledOutForAppointment,
        appointment,
        paperworkPages,
        location,
      );
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    const itemsToExclude: string[] = [];
    if (!paperworkFilledOutForAppointment) {
      console.log(
        `Paperwork is not filled out for this appointment, getting a recent questionnaire response for patient ${appointmentPatient}`,
      );
      questionnaireResponseResource = await getRecentQuestionnaireResponse(
        questionnaire.id,
        appointmentPatient,
        fhirClient,
      );
      if (questionnaireResponseResource && questionnaireResponseResource.item) {
        responses = await updateQuestionnaireResponseItems(questionnaireResponseResource.item, itemsNotToPrefill);
      }
    }

    if (questionnaireResponseResource) {
      itemsToExclude.push(...['point-of-discovery-additional-text', 'patient-point-of-discovery']);
    }

    paperworkPages = paperworkPages.map((paperworkPage) => ({
      ...paperworkPage,
      questions: paperworkPage.questions.filter((question) => !itemsToExclude.includes(question.id)),
    }));

    const partialAppointment = getPaperworkForUserWithoutAccess(
      paperworkComplete,
      paperworkFilledOutForAppointment,
      appointment,
      paperworkPages,
      location,
    );

    console.log(`getting presigned urls for any current document reference files for patient ${appointmentPatient}`);
    // Get DocumentReference codings from Questionnaire
    const docTypes: string[] = [];
    const fileQuestionIDs: string[] = [];

    paperworkPages.forEach((page: PaperworkPage) => {
      const questionDocTypes: string[] = [];
      page.questions.forEach((question) => {
        if (question.type === 'File') {
          fileQuestionIDs.push(question.id);
          question.docType && questionDocTypes.push(question.docType);
        }
      });
      questionDocTypes.forEach((type) => !docTypes.includes(type) && docTypes.push(type));
    });

    // Get presigned urls from DocumentReferences
    const presignedURLs = await getPresignedURLsfromDocRefURLs(
      appointmentPatient,
      fileQuestionIDs,
      docTypes,
      fhirClient,
    );

    console.log('building get paperwork response');
    const response: PaperworkResponseWithResponses = {
      ...partialAppointment,
      paperwork: responses,
      files: presignedURLs,
    };
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('get-paperwork', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

function getPaperworkForUserWithoutAccess(
  completedPaperwork: boolean,
  paperworkFilledOutForAppointment: boolean,
  appointment: Appointment | undefined,
  questions: PaperworkPage[],
  location: Location | undefined,
): PaperworkResponseWithoutResponses {
  return {
    message: 'Successfully retrieved appointment date/time and paperwork status for this appointment',
    questions: questions,
    paperworkCompleteOrInProgress: completedPaperwork || paperworkFilledOutForAppointment,
    appointment: {
      start: appointment?.start || 'Unknown',
      location: {
        id: location?.id,
        slug: location?.identifier?.find(
          (identifierTemp) => identifierTemp.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
        )?.value,
        name: location?.name,
        description: location?.description,
        address: location?.address,
        telecom: location?.telecom,
        hoursOfOperation: location?.hoursOfOperation,
        timezone: location?.extension?.find(
          (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
        )?.valueString,
      },
      visitType: appointment?.appointmentType?.text as VisitType,
      status: appointment?.status,
    },
  };
}

async function updateQuestionnaireResponseItems(
  questionnaireResponseItems: QuestionnaireResponseItem[],
  itemsNotToPrefill: string[],
): Promise<any> {
  const responses: any = {};
  questionnaireResponseItems
    .filter((responseTemp) => !itemsNotToPrefill.includes(responseTemp.linkId))
    .map((responseTemp) => {
      responses[responseTemp.linkId] =
        responseTemp.answer?.[0].valueString ||
        responseTemp.answer?.[0].valueDate ||
        responseTemp.answer?.[0].valueBoolean ||
        '';
    });
  return responses;
}

async function getPresignedURLsfromDocRefURLs(
  patientID: string,
  fileQuestionIDs: string[],
  docTypes: string[],
  fhirClient: FhirClient,
  // z3Client: Z3Client,
  // projectAPI: string
): Promise<FileURLs | undefined> {
  const docRefResources = await fhirClient.searchResources<DocumentReference>({
    resourceType: 'DocumentReference',
    searchParams: [
      {
        name: 'status',
        value: 'current',
      },
      {
        name: 'related',
        value: `Patient/${patientID}`,
      },
      {
        name: 'type',
        value: docTypes.join(','),
      },
      { name: '_sort', value: '-_lastUpdated' },
    ],
  });

  console.log('checking returned document references for photo IDs and insurance cards');

  const presignedUrlObj: FileURLs = {};

  for (const type of docTypes) {
    // Find a DocumentReference that matches the coding
    const docRefTemp = docRefResources.find((docRef) => docRef.type?.coding?.find((coding) => coding.code === type));
    // Get Z3 URLs and presigned URLS for each id
    for (const id of fileQuestionIDs) {
      const z3URL = docRefTemp?.content.find((content) => content.attachment.title === id)?.attachment.url;
      if (z3URL) {
        presignedUrlObj[id] = { z3Url: z3URL, presignedUrl: await getPresignedURL(z3URL) };
      }
    }
  }

  async function getPresignedURL(url: string): Promise<string> {
    console.log('getting presigned url');
    // const { bucket, object } = getBucketAndObjectFromZ3URL(url, projectAPI);
    // const presignedUrl = (await z3Client.createPresignedUrl(bucket, object)).signedUrl;
    const presignedURLRequest = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${zapehrToken}`,
      },
      body: JSON.stringify({ action: 'download' }),
    });
    const presignedURLResponse = await presignedURLRequest.json();
    const presignedUrl = presignedURLResponse.signedUrl;
    return presignedUrl;
  }

  return presignedUrlObj;
}
