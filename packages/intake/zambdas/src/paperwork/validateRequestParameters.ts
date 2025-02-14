import { QuestionnaireResponseItem, QuestionnaireResponse } from 'fhir/r4b';
import {
  PatchPaperworkParameters,
  QUESTIONNAIRE_RESPONSE_INVALID_ERROR,
  getQuestionnaireItemsAndProgress,
  makeValidationSchema,
  recursiveGroupTransform,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import Oystehr from '@oystehr/sdk';
import { ValidationError } from 'yup';

interface BasicInput extends PatchPaperworkParameters {
  ipAddress: string;
  appointmentId?: string;
}
interface PatchPaperworkZambdaInput extends Omit<BasicInput, 'answers'> {
  answers: QuestionnaireResponseItem;
}

interface SubmitPaperworkZambdaInput extends Omit<BasicInput, 'answers'>, ZambdaInput {
  answers: QuestionnaireResponseItem[];
}

export interface PatchPaperworkEffectInput {
  updatedAnswers: QuestionnaireResponseItem[];
  patchIndex: number;
  questionnaireResponseId: string;
  currentQRStatus: QuestionnaireResponse['status'];
}

export interface SubmitPaperworkEffectInput extends Omit<BasicInput, 'answers'>, ZambdaInput {
  answers: QuestionnaireResponseItem[];
  updatedAnswers: QuestionnaireResponseItem[];
  questionnaireResponseId: string;
  currentQRStatus: QuestionnaireResponse['status'];
}

const basicValidation = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const inputJSON = JSON.parse(input.body);
  const { answers, questionnaireResponseId, appointmentId } = inputJSON;

  if (!answers) {
    throw new Error(`"answers" is a required param`);
  }
  if (questionnaireResponseId == undefined) {
    throw new Error(`"questionnaireResponseId" is a required param`);
  }
  if (typeof questionnaireResponseId !== 'string') {
    throw new Error(`"questionnaireResponseId" must be a string`);
  }

  if (appointmentId && typeof appointmentId !== 'string') {
    throw new Error(`"appointmentId" must be a string`);
  }

  let ipAddress = '';
  const environment = process.env.ENVIRONMENT || input.secrets?.ENVIRONMENT;
  console.log('Environment: ', environment);
  switch (environment) {
    case 'local':
      ipAddress = input?.requestContext?.identity?.sourceIp ? input.requestContext.identity.sourceIp : 'Unknown';
      break;
    case 'dev':
    case 'testing':
    case 'staging':
    case 'production':
      ipAddress = input?.headers?.['cf-connecting-ip'] ? input.headers['cf-connecting-ip'] : 'Unknown';
      break;
    default:
      ipAddress = 'Unknown';
  }

  return { answers, questionnaireResponseId, ipAddress, appointmentId };
};

const itemAnswerHasValue = (item: QuestionnaireResponseItem): boolean => {
  if (item.answer === undefined || item.answer?.length === 0) {
    return false;
  }
  return item.answer?.every((obj) => {
    if (typeof obj !== 'object') {
      return false;
    }
    return Object.values(obj).some((v) => !!v);
  });
};

export const mapQuestionnaireResponsesToObject = (answers: QuestionnaireResponseItem[]): any => {
  return answers.reduce((accum, ans) => {
    accum[ans.linkId] = ans.answer;
    return accum;
  }, {} as any);
};

const complexSubmitValidation = async (
  input: SubmitPaperworkZambdaInput,
  oystehr: Oystehr
): Promise<SubmitPaperworkEffectInput> => {
  const { answers: prevalidationAnswers, questionnaireResponseId } = input;
  const qrAndQItems = await getQuestionnaireItemsAndProgress(questionnaireResponseId, oystehr);

  if (!qrAndQItems) {
    throw new Error(`Questionnaire could not be found for QuestionnaireResponse with id ${questionnaireResponseId}`);
  }

  const { items, fullQRResource } = qrAndQItems;

  const currentAnswers = fullQRResource.item ?? [];

  console.log('validating updates for questionnaire response', questionnaireResponseId);

  const submittedAnswers = prevalidationAnswers.filter((answerItem) => {
    const item = items.find((questionItem) => {
      return questionItem.linkId === answerItem.linkId;
    });
    if (!item) {
      console.log('no item found', answerItem.linkId);
      return false;
    }
    // because it may be more convenient to keep readOnly items in form state for purposes of front-end validation of dependent fields,
    // we merely filter them out here so there inclusion is a no-op rather than an error
    if (item.readOnly) {
      return false;
    }
    return true;
  });

  // console.log('submitted answers', JSON.stringify(submittedAnswers));

  const updatedAnswers: QuestionnaireResponseItem[] = currentAnswers ? [...currentAnswers] : [];
  submittedAnswers.forEach((sa) => {
    const idx = currentAnswers.findIndex((ua) => {
      return sa.linkId === ua.linkId && sa.answer !== undefined;
    });
    if (idx >= 0) {
      // fhir api will throw an error if we submit, for instance { valueString: '' }
      if (itemAnswerHasValue(sa)) {
        updatedAnswers.splice(idx, 1, sa);
      } else {
        updatedAnswers.splice(idx, 1);
      }
    } else {
      if (itemAnswerHasValue(sa)) {
        updatedAnswers.push(sa);
      }
    }
  });

  const validationSchema = makeValidationSchema(items, undefined);
  console.log('answersToValidate', JSON.stringify(updatedAnswers));
  try {
    await validationSchema.validate(updatedAnswers, { abortEarly: false });
  } catch (e) {
    const validationErrors = (e as any).inner as ValidationError[];
    if (Array.isArray(validationErrors)) {
      const errorPaths = validationErrors
        .map((e) => {
          return e.path?.split('.')?.[0];
        })
        .filter((i) => !!i) as string[];

      console.log('errorpaths', JSON.stringify(errorPaths));

      if (errorPaths.length === 0) {
        // this will be a 500
        throw validationErrors;
      }
      const pageAndFieldErrors = errorPaths.reduce(
        (accum, currentPath) => {
          let pageName: string | undefined;
          let fieldName: string | undefined;
          items.forEach((page) => {
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

  console.log('validation succeeded');

  return {
    ...input,
    questionnaireResponseId,
    updatedAnswers,
    currentQRStatus: fullQRResource.status,
  };
};
const complexPatchValidation = async (
  input: PatchPaperworkZambdaInput,
  oystehr: Oystehr
): Promise<PatchPaperworkEffectInput> => {
  // we should return QR id and use it to get both appointment Id and Questionnaire
  const { answers: itemToPatch, questionnaireResponseId } = input;
  const qrAndQItems = await getQuestionnaireItemsAndProgress(questionnaireResponseId, oystehr);

  if (!qrAndQItems) {
    throw new Error(`Questionnaire could not be found for QuestionnaireResponse with id ${questionnaireResponseId}`);
  }

  const { items, fullQRResource } = qrAndQItems;

  console.log('validating updates for questionnaire response', questionnaireResponseId);

  console.log('existing QR: ', JSON.stringify(fullQRResource));
  const readOnlyItems: Set<string> = new Set();
  const itemsForThisPage = items.find((i) => i.linkId === itemToPatch.linkId)?.item ?? [];
  console.log('items for this page', JSON.stringify(itemsForThisPage));
  itemsForThisPage.forEach((i) => {
    if (i.readOnly) {
      readOnlyItems.add(i.linkId);
    }
  });

  const currentAnswersForPage = fullQRResource.item?.find((i) => i.linkId === itemToPatch.linkId)?.item;
  const currentAnswersToKeep = (currentAnswersForPage ?? []).filter((ans) => readOnlyItems.has(ans.linkId));
  console.log('current answers to keep', JSON.stringify(currentAnswersToKeep));

  // console.log('current answers', JSON.stringify(currentAnswers));

  const submittedAnswers = recursiveGroupTransform(itemsForThisPage, itemToPatch.item);

  // console.log('submitted answers', JSON.stringify(submittedAnswers));
  const updatedAnswerIndex: number = items.findIndex((item) => {
    return item.linkId === itemToPatch.linkId;
  });

  console.log('submittedAnswers', JSON.stringify(submittedAnswers));

  console.log('validation succeeded');

  return {
    questionnaireResponseId,
    updatedAnswers: [...currentAnswersToKeep, ...submittedAnswers],
    patchIndex: updatedAnswerIndex,
    currentQRStatus: fullQRResource.status,
  };
};

export const validatePatchInputs = async (input: ZambdaInput, oystehr: Oystehr): Promise<PatchPaperworkEffectInput> => {
  const basic = basicValidation(input);
  const { answers } = basic;
  const ansObj = answers as QuestionnaireResponseItem;
  if (typeof ansObj !== 'object' || ansObj.item === undefined || ansObj.linkId === undefined) {
    throw new Error(`"answers" must be a questionnaire response item with defined "item" field`);
  }
  console.log('answer object from body: ', JSON.stringify(ansObj), basic.questionnaireResponseId);
  return complexPatchValidation({ ...basic, answers: ansObj }, oystehr);
};

export const validateSubmitInputs = async (
  input: ZambdaInput,
  oystehr: Oystehr
): Promise<SubmitPaperworkEffectInput> => {
  const basic = basicValidation(input);
  const { answers } = basic;
  if (!Array.isArray(answers)) {
    throw new Error(`"answers" must be an array`);
  }

  answers.forEach((ans) => {
    if (typeof ans !== 'object' || !ans.linkId || typeof ans.linkId !== 'string') {
      throw new Error(`"answers" must be an array of QuestionnaireResponseItems`);
    }
  });
  const submitInput = { ...basic, ...input, answers: answers };
  const complex = await complexSubmitValidation(submitInput, oystehr);
  return { ...complex, ...input, ipAddress: basic.ipAddress };
};
