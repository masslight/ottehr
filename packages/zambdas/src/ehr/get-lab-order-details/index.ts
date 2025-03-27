import { APIGatewayProxyResult } from 'aws-lambda';
import { OrderDetails } from 'utils';
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

    const { serviceRequest, practitioner, questionnaireResponse, task } = await getLabOrderResources(
      oystehr,
      serviceRequestID
    );

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
      sampleCollectionDateTime: DateTime.now().toString(),
      labQuestions: questionnaire,
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
