import { APIGatewayProxyResult } from 'aws-lambda';
import { LAB_ACCOUNT_NUMBER_SYSTEM, OrderDetails } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';
import { ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { ActivityDefinition, Questionnaire } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getLabOrderResources } from '../shared/labs';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequestID, secrets } = validateRequestParameters(input);

    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    console.log('token', m2mtoken);

    const oystehr = createOystehrClient(m2mtoken, secrets);

    const {
      serviceRequest,
      practitioner,
      questionnaireResponse,
      task,
      organization: org,
    } = await getLabOrderResources(oystehr, serviceRequestID);

    if (!task.authoredOn) {
      throw new Error('task.authoredOn is undefined');
    }

    const questionnaireUrl = questionnaireResponse.questionnaire;

    if (!questionnaireUrl) {
      throw new Error('questionnaire is not found');
    }
    const questionnaireRequest = await fetch(questionnaireUrl, {
      headers: {
        Authorization: `Bearer ${m2mtoken}`,
      },
    });
    const questionnaire: Questionnaire = await questionnaireRequest.json();

    const accountNumber = org.identifier?.find((identifier) => identifier.system === LAB_ACCOUNT_NUMBER_SYSTEM)?.value;

    if (!accountNumber) {
      throw new Error('accountNumber not found on ServiceRequest.performer Organization resource');
    }

    const questionnaireResponseItems = questionnaireResponse.item?.map((item) => {
      const question = questionnaire.item?.find((q) => q.linkId === item.linkId);
      if (!question) {
        throw new Error(`question ${item.linkId} is not found`);
      }
      return {
        linkId: item.linkId,
        type: question.type,
        response: item.answer?.map((answer) => {
          if (question.type === 'text') {
            return answer.valueString;
          } else if (question.type === 'boolean') {
            return answer.valueBoolean;
          } else if (question.type === 'date') {
            return answer.valueDate;
          } else if (question.type === 'decimal') {
            return answer.valueDecimal;
          } else if (question.type === 'integer') {
            return answer.valueInteger;
          } else if (question.type === 'choice') {
            return answer.valueString;
          } else {
            throw new Error(`Unknown question type: ${question.type}`);
          }
        }),
      };
    });

    const orderDetails: OrderDetails = {
      diagnosis: serviceRequest?.reasonCode?.map((reasonCode) => reasonCode.text).join('; ') || 'Missing diagnosis',
      patientName: 'Patient Name',
      orderName: (serviceRequest?.contained?.[0] as ActivityDefinition)?.title || 'Missing Order name',
      orderTypeDetail: serviceRequest.orderDetail?.[0].text || 'Missing order type detail',
      orderingPhysician: practitioner.name
        ? oystehr?.fhir.formatHumanName(practitioner.name?.[0]) || 'Missing Provider name'
        : 'Missing Provider name',
      orderDateTime: task.authoredOn,
      labName: (serviceRequest?.contained?.[0] as ActivityDefinition).publisher || 'Missing Publisher name',
      accountNumber: accountNumber,
      sampleCollectionDateTime: DateTime.now().toString(),
      labQuestions: questionnaire,
      labQuestionnaireResponses: questionnaireResponseItems,
    };

    return {
      body: JSON.stringify(orderDetails),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error getting lab order details' }),
      statusCode: 500,
    };
  }
};
