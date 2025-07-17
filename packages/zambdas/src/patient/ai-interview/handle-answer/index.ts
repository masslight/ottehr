import { BaseMessageLike } from '@langchain/core/messages';
import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { createOystehrClient, getSecret, HandleAnswerInput, Secrets, SecretsKeys } from 'utils';
import {
  assertDefined,
  getAuth0Token,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { invokeChatbot } from '../../../shared/ai';
import { INTERVIEW_COMPLETED } from '../start';

const ZAMBDA_NAME = 'handle-answer';

let oystehrToken: string;

interface Input extends HandleAnswerInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponseId, linkId, answer, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });
    if (questionnaireResponse.status === 'completed') {
      throw new Error('QuestionnaireResponse is completed.');
    }
    questionnaireResponse.item?.push({
      linkId,
      answer: [
        {
          valueString: answer,
        },
      ],
    });
    const chatbotInput = createChatbotInput(questionnaireResponse);
    if (chatbotInput == null || chatbotInput.length === 0) {
      throw new Error(`Invalid chatbot input "${chatbotInput}"`);
    }
    console.log(`chatbotInput: ${JSON.stringify(chatbotInput)}`);
    const chatbotResponse = (await invokeChatbot(chatbotInput, secrets)).content.toString();
    (questionnaireResponse.contained?.[0] as Questionnaire).item?.push({
      linkId: (parseInt(linkId) + 1).toString(),
      text: chatbotResponse,
      type: 'text',
    });
    if (chatbotResponse.includes(INTERVIEW_COMPLETED)) {
      questionnaireResponse.status = 'completed';
    }
    return {
      statusCode: 200,
      body: JSON.stringify(await oystehr.fhir.update(questionnaireResponse)),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
});

function validateInput(input: ZambdaInput): Input {
  const { questionnaireResponseId, linkId, answer } = validateJsonBody(input);
  return {
    questionnaireResponseId: validateString(questionnaireResponseId, 'questionnaireResponseId'),
    linkId: validateString(linkId, 'linkId'),
    answer: validateString(answer, 'answer'),
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(
    oystehrToken,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );
}

function createChatbotInput(questionnaireResponse: QuestionnaireResponse): BaseMessageLike[] | undefined {
  const questionnaire = questionnaireResponse.contained?.[0] as Questionnaire;
  return questionnaire.item
    ?.sort((itemA, itemB) => parseInt(itemA.linkId) - parseInt(itemB.linkId))
    ?.flatMap<BaseMessageLike>((questionItem) => {
      const answerItem = assertDefined(
        questionnaireResponse.item?.find((answerItem) => answerItem.linkId === questionItem.linkId),
        `Answer for question "${questionItem.linkId}"`
      );
      const questionText = assertDefined(questionItem.text, `Text of question "${questionItem.linkId}"`);
      const answerText = assertDefined(
        answerItem.answer?.[0]?.valueString,
        `Text of answer to question "${questionItem.linkId}"`
      );
      if (questionItem.linkId == '0') {
        return [{ role: 'user', content: answerText }];
      }
      return [
        { role: 'assistant', content: questionText },
        { role: 'user', content: answerText },
      ];
    });
}
