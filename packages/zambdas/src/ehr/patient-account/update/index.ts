import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AuditEvent, Bundle, Questionnaire, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AUDIT_EVENT_OUTCOME_CODE,
  checkBundleOutcomeOk,
  getSecret,
  getVersionedReferencesFromBundleResources,
  isValidUUID,
  makeValidationSchema,
  mapQuestionnaireAndValueSetsToItemsList,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  QUESTIONNAIRE_NOT_FOUND_FOR_QR_ERROR,
  QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR,
  QUESTIONNAIRE_RESPONSE_INVALID_ERROR,
  Secrets,
  SecretsKeys,
  UpdatePatientAccountResponse,
} from 'utils';
import { ValidationError } from 'yup';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { updatePatientAccountFromQuestionnaire } from '../../shared/harvest';

const ZAMBDA_NAME = 'update-patient-account';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('complexly validating request parameters');
    const effectInput = await complexValidation(validatedParameters, oystehr);
    console.log('complex validation successful');
    await performEffect(effectInput, oystehr);
    const response: UpdatePatientAccountResponse = { result: 'success' };
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('update-patient-account-from-questionnaire', error, ENVIRONMENT);
  }
});

const performEffect = async (input: FinishedInput, oystehr: Oystehr): Promise<void> => {
  const { questionnaireResponse, items, patientId, providerProfileReference, preserveOmittedCoverages } = input;

  let resultBundle: Bundle;
  try {
    resultBundle = await updatePatientAccountFromQuestionnaire(
      { questionnaireResponseItem: items, patientId, preserveOmittedCoverages },
      oystehr
    );
  } catch (e) {
    console.error('error updating patient account from questionnaire', e);
    const ae = await writeAuditEvent(
      { resultBundle: null, providerProfileReference, questionnaireResponse, patientId },
      oystehr
    );
    console.log('wrote audit event: ', `AuditEvent/${ae.id}`);
    throw e;
  }

  console.log('resultBundle', JSON.stringify(resultBundle, null, 2));

  const ae = await writeAuditEvent(
    { resultBundle, providerProfileReference, questionnaireResponse, patientId },
    oystehr
  );

  console.log('wrote audit event: ', `AuditEvent/${ae.id}`);
};

interface AuditEventInput {
  resultBundle: Bundle | null;
  providerProfileReference: string;
  questionnaireResponse: QuestionnaireResponse;
  patientId: string;
}

const writeAuditEvent = async (input: AuditEventInput, oystehr: Oystehr): Promise<AuditEvent> => {
  const { resultBundle, providerProfileReference, patientId, questionnaireResponse } = input;
  const outcome = (() => {
    if (!resultBundle) {
      return AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
    }
    return checkBundleOutcomeOk(resultBundle)
      ? AUDIT_EVENT_OUTCOME_CODE.success
      : AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
  })();
  const contained: AuditEvent['contained'] = [{ ...questionnaireResponse, id: 'inputQR' }];
  const entity: AuditEvent['entity'] = [
    {
      what: {
        reference: '#inputQR',
        type: 'QuestionnaireResponse',
      },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '4',
        display: 'Domain Resource',
      },
      description: 'Resource submitted by the author describing changes to the patient record',
    },
    {
      what: {
        reference: `Patient/${patientId}`,
      },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '1',
        display: 'Patient',
      },
    },
  ];
  if (resultBundle) {
    entity.push(
      ...getVersionedReferencesFromBundleResources(resultBundle).map((reference) => {
        return {
          what: reference,
          role: {
            system: 'http://terminology.hl7.org/CodeSystem/object-role',
            code: '4',
            display: 'Domain Resource',
          },
          description: 'Resource updated as a result of processing a QuestionnaireResponse submitted by the author',
        };
      })
    );
  }
  const auditEvent: AuditEvent = {
    resourceType: 'AuditEvent',
    contained,
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle',
      code: 'originate',
      display: 'Originate/Retain Record Lifecycle Event',
    },
    recorded: DateTime.now().toISO(),
    outcome,
    agent: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'AUT',
              display: 'author (originator)',
            },
          ],
        },
        who: {
          reference: providerProfileReference,
        },
        requestor: true,
      },
    ],
    source: {
      site: 'Ottehr',
      observer: {
        reference: providerProfileReference,
      },
    },
    entity,
  };
  return oystehr.fhir.create(auditEvent);
};

interface BasicInput {
  userToken: string;
  patientId: string;
  questionnaireResponse: QuestionnaireResponse;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  const { secrets } = input;
  const { questionnaireResponse } = JSON.parse(input.body);
  if (questionnaireResponse === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['questionnaireResponse']);
  }
  if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse must be of type QuestionnaireResponse');
  }
  if (!questionnaireResponse.item?.length) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.item may not be missing or empty');
  }
  if (!questionnaireResponse.questionnaire) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR(
      'questionnaireResponse must have a canonical reference on its "questionnaire" field'
    );
  } else if (questionnaireResponse.questionnaire.split('|').length !== 2) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR(
      'questionnaireResponse must have a valid canonical reference on its "questionnaire" field'
    );
  }
  const subject = questionnaireResponse.subject?.reference;
  if (!subject) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.subject may not be missing');
  }
  const [resourceType, patientId] = subject.split('/');

  if (resourceType !== 'Patient') {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.subject must be of type Patient');
  }

  if (isValidUUID(patientId) === false) {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse.subject must have a valid UUID');
  }

  return {
    questionnaireResponse,
    secrets,
    userToken,
    patientId,
  };
};

interface FinishedInput extends BasicInput {
  providerProfileReference: string;
  items: QuestionnaireResponseItem[];
  preserveOmittedCoverages: boolean;
}

const complexValidation = async (input: BasicInput, oystehrM2M: Oystehr): Promise<FinishedInput> => {
  const { secrets, userToken, questionnaireResponse } = input;
  console.log('questionnaireResponse', JSON.stringify(questionnaireResponse));
  const oystehr = createOystehrClient(userToken, secrets);
  const user = await oystehr.user.me();
  if (!user) {
    throw NOT_AUTHORIZED;
  }

  const providerProfileReference = user.profile;

  if (!providerProfileReference) {
    throw NOT_AUTHORIZED;
  }
  const [url, version] = (questionnaireResponse.questionnaire ?? ' | ').split('|');
  const questionnaire = (
    await oystehrM2M.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        {
          name: 'url',
          value: url,
        },
        {
          name: 'version',
          value: version,
        },
      ],
    })
  ).unbundle()[0];
  if (!questionnaire) {
    throw QUESTIONNAIRE_NOT_FOUND_FOR_QR_ERROR;
  }

  const preserveOmittedCoverages = questionnaireResponse.item?.length === 1;
  console.log('preserveOmittedCoverages', preserveOmittedCoverages);

  const questionnaireItems = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);
  const validationSchema = makeValidationSchema(questionnaireItems, undefined);
  // when a coverage is added via the add coverage modal, a single item with the data for the added coverage is sent to
  // this endpoint. passing this allows us to refrain from removing any existing coverages from the account when a new one is added.
  try {
    await validationSchema.validate(questionnaireResponse.item, { abortEarly: false });
  } catch (e) {
    const validationErrors = (e as any).inner as ValidationError[];
    if (Array.isArray(validationErrors)) {
      const errorPaths = validationErrors
        .map((e) => {
          return e.path?.split('.')?.[0];
        })
        .filter((i) => !!i) as string[];
      console.log('validationErrors', JSON.stringify(validationErrors, null, 2));
      console.log('errorPaths', JSON.stringify(errorPaths));

      if (errorPaths.length === 0) {
        // this will be a 500
        throw validationErrors;
      }
      const pageAndFieldErrors = errorPaths.reduce(
        (accum, currentPath) => {
          let pageName: string | undefined;
          let fieldName: string | undefined;
          questionnaireItems.forEach((page) => {
            const itemWithError = (page.item ?? []).find((i) => {
              return i.linkId === currentPath;
            });
            if (itemWithError) {
              pageName = page.linkId;
              fieldName = itemWithError.text ?? itemWithError.linkId;
            }
          });
          if (pageName && fieldName) {
            const currentErrorList = accum[pageName] ?? [];
            currentErrorList.push(fieldName);
            accum[pageName] = currentErrorList;
          }
          return accum;
        },
        {} as { [pageName: string]: string[] }
      );
      if (Object.keys(pageAndFieldErrors).length === 0) {
        throw validationErrors;
      }
      console.log('pages with errors: ', JSON.stringify(pageAndFieldErrors));
      throw QUESTIONNAIRE_RESPONSE_INVALID_ERROR(pageAndFieldErrors);
    } else {
      console.log('guess its not an array', e);
      throw validationErrors;
    }
  }

  const items = questionnaireResponse.item ?? [];

  return {
    ...input,
    providerProfileReference,
    items,
    preserveOmittedCoverages,
  };
};
