import { getRandomValues } from 'crypto';
import {
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from 'fhir/r4b';
import { DynamicAOEInput } from 'utils';

export interface AOEDisplayForOrderForm {
  question: string;
  answer: any[];
}

export const populateQuestionnaireResponseItems = async (
  questionnaireResponse: QuestionnaireResponse,
  data: DynamicAOEInput,
  m2mToken: string
): Promise<{
  questionnaireResponseItems: QuestionnaireResponseItem[];
  questionsAndAnswersForFormDisplay: AOEDisplayForOrderForm[];
}> => {
  const questionnaireUrl = questionnaireResponse.questionnaire;

  if (!questionnaireUrl) {
    throw new Error('questionnaire is not found');
  }

  console.log(questionnaireUrl);

  const questionnaireRequest = await fetch(questionnaireUrl, {
    headers: {
      Authorization: `Bearer ${m2mToken}`,
    },
  });

  const questionnaire: Questionnaire = await questionnaireRequest.json();

  if (!questionnaire.item) {
    throw new Error('questionnaire item is not found');
  }

  const questionsAndAnswersForFormDisplay: AOEDisplayForOrderForm[] = [];

  const questionnaireResponseItems: QuestionnaireResponseItem[] = Object.keys(data).map((questionResponse) => {
    const question = questionnaire.item?.find((item) => item.linkId === questionResponse);
    if (!question) {
      throw new Error('question is not found');
    }

    let answer: QuestionnaireResponseItemAnswer[] | undefined = undefined;
    let answerForDisplay = data[questionResponse] !== undefined ? data[questionResponse] : 'UNKNOWN';

    const multiSelect = question.extension?.find(
      (currentExtension) =>
        currentExtension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type' &&
        currentExtension.valueString === 'multi-select list'
    );
    if (question.type === 'text' || (question.type === 'choice' && !multiSelect)) {
      answer = [
        {
          valueString: data[questionResponse],
        },
      ];
    }
    if (multiSelect) {
      answer = data[questionResponse].map((item: string) => ({ valueString: item }));
      answerForDisplay = data[questionResponse].join(', ');
    }

    if (question.type === 'boolean') {
      answer = [
        {
          valueBoolean: data[questionResponse],
        },
      ];
      answerForDisplay = answerForDisplay === true ? 'Yes' : answerForDisplay === false ? 'No' : answerForDisplay;
    }

    if (question.type === 'date') {
      answer = [
        {
          valueDate: data[questionResponse],
        },
      ];
    }

    if (question.type === 'decimal') {
      answer = [
        {
          valueDecimal: data[questionResponse],
        },
      ];
    }

    if (question.type === 'integer') {
      answer = [
        {
          valueInteger: data[questionResponse],
        },
      ];
    }

    if (answer == undefined) {
      throw new Error('answer is undefined');
    }

    if (answerForDisplay !== undefined && answerForDisplay !== '')
      questionsAndAnswersForFormDisplay.push({
        question: question.text || 'UNKNOWN',
        answer: answerForDisplay,
      });

    return {
      linkId: questionResponse,
      answer: answer,
    };
  });

  return { questionnaireResponseItems, questionsAndAnswersForFormDisplay };
};

export function createOrderNumber(length: number): string {
  // https://sentry.io/answers/generate-random-string-characters-in-javascript/
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
}
