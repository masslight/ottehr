import { APIGatewayProxyResult } from 'aws-lambda';
import { getPatchBinary } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';
import {
  Provenance,
  Questionnaire,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  ServiceRequest,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import { getLabOrderResources } from '../shared/labs';
import { createExternalLabsOrderFormPDF } from '../shared/pdf/external-labs-order-form-pdf';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequestID, data, secrets } = validateRequestParameters(input);

    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    console.log('token', m2mtoken);

    const oystehr = createOystehrClient(m2mtoken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const currentUser = await createOystehrClient(userToken, secrets).user.me();

    const {
      serviceRequest,
      patient,
      practitioner: provider,
      questionnaireResponse,
      task,
    } = await getLabOrderResources(oystehr, serviceRequestID);
    const questionnaireUrl = questionnaireResponse.questionnaire;

    if (!questionnaireUrl) {
      throw new Error('questionnaire is not found');
    }
    console.log(questionnaireUrl);
    const questionnaireRequest = await fetch(questionnaireUrl, {
      headers: {
        Authorization: `Bearer ${m2mtoken}`,
      },
    });
    const questionnaire: Questionnaire = await questionnaireRequest.json();
    if (!questionnaire.item) {
      throw new Error('questionnaire item is not found');
    }
    const questionnaireItems: QuestionnaireResponseItem[] = Object.keys(data).map((questionResponse) => {
      const question = questionnaire.item?.find((item) => item.linkId === questionResponse);
      if (!question) {
        throw new Error('question is not found');
      }
      let answer: QuestionnaireResponseItemAnswer[] | undefined = undefined;
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
        answer = data[questionResponse].map((item: any) => ({ valueString: item }));
      }
      if (question.type === 'boolean') {
        answer = [
          {
            valueBoolean: data[questionResponse],
          },
        ];
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
      return {
        linkId: questionResponse,
        answer: answer,
      };
    });
    // const intakeQuestionnaireItems: IntakeQuestionnaireItem[] = questionnaire.item?.map((item) => ({
    //   //   linkId: item.linkId,
    //   //   type: item.type,
    //   alwaysFilter: false,
    //   acceptsMultipleAnswers: false,
    //   ...item,
    // }));
    // const validationSchema = makeValidationSchema(questionnaireItems);
    // console.log(5, data);
    // console.log(1, validationSchema);
    // try {
    //   await validationSchema.validate(data, { abortEarly: false });
    //   console.log(test);
    // } catch (error) {
    //   console.log(error);
    //   throw new Error('error when validating the labs');
    // }

    const now = DateTime.now();
    const fhirUrl = `urn:uuid:${uuid()}`;
    const provenanceFhir: Provenance = {
      resourceType: 'Provenance',
      target: [
        {
          reference: `ServiceRequest/${serviceRequest.id}`,
        },
      ],
      recorded: now.toISO(),
      location: task.location,
      agent: [
        {
          who: task.owner ? task.owner : { reference: currentUser?.profile },
        },
      ],
    };
    const request = await oystehr?.fhir.transaction({
      requests: [
        getPatchBinary({
          resourceType: 'QuestionnaireResponse',
          resourceId: questionnaireResponse.id || 'unknown',
          patchOperations: [
            {
              op: 'add',
              path: '/item',
              value: questionnaireItems,
            },
            {
              op: 'replace',
              path: '/status',
              value: 'completed',
            },
          ],
        }),
        getPatchBinary({
          resourceType: 'ServiceRequest',
          resourceId: serviceRequest.id || 'unknown',
          patchOperations: [
            {
              path: '/status',
              op: 'replace',
              value: 'active',
            },
          ],
        }),
        {
          method: 'POST',
          url: '/Provenance',
          fullUrl: fhirUrl,
          resource: provenanceFhir,
        },
        getPatchBinary({
          resourceType: 'Task',
          resourceId: task.id || 'unknown',
          patchOperations: [
            {
              op: 'add',
              path: '/owner',
              value: {
                reference: currentUser?.profile,
              },
            },
            {
              op: 'add',
              path: '/relevantHistory',
              value: [
                {
                  reference: fhirUrl,
                },
              ],
            },
          ],
        }),
      ],
    });

    const submitLabRequest = await fetch('https://labs-api.zapehr.com/v1/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${m2mtoken}`,
      },
      body: JSON.stringify({
        serviceRequest: `ServiceRequest/${serviceRequest.id}`,
        accountNumber: 'teset',
      }),
    });
    if (!submitLabRequest.ok) {
      const submitLabRequestResponse = await submitLabRequest.json();
      console.log(submitLabRequestResponse);
      throw new Error('error submitting lab request');
    }

    if (!patient.id) {
      throw new Error('patient.id is undefined');
    }

    const serviceRequestTemp: ServiceRequest = await oystehr.fhir.get({
      resourceType: 'ServiceRequest',
      id: serviceRequestID,
    });
    const orderID = serviceRequestTemp.identifier?.find(
      (item) => item.system === 'https://identifiers.fhir.oystehr.com/lab-order-placer-id'
    )?.value;

    const pdfDetail = await createExternalLabsOrderFormPDF(
      {
        locationName: 'test', // check with sarah
        locationStreetAddress: 'test',
        locationCity: 'test',
        locationState: 'test',
        locationZip: 'test',
        locationPhone: 'test',
        locationFax: 'test',
        reqId: orderID || 'UNKNOWN',
        providerName: provider.name ? oystehr.fhir.formatHumanName(provider.name[0]) : 'UNKNOWN',
        providerTitle: 'test', // qualifications
        providerNPI: 'test',
        serviceName: 'test',
        patientFirstName: patient.name?.[0].given?.[0] || 'UNKNOWN',
        patientMiddleName: '',
        patientLastName: patient.name?.[0].family || 'UNKNOWN',
        patientSex: patient.gender || 'UNKNOWN',
        patientDOB: patient.birthDate || 'UNKNOWN',
        patientId: patient.id,
        patientAddress: patient.address?.[0] ? oystehr.fhir.formatAddress(patient.address[0]) : 'UNKNOWN',
        patientPhone: patient.telecom?.[0].value || 'UNKNOWN',
        todayDate: now.toFormat('MM/dd/yyyy'),
        orderDate: now.toFormat('MM/dd/yyyy'),
        aoeAnswers: [''],
        labType: 'test', // orderName
        assessmentCode: 'test', // service request reason code
        assessmentName: 'test',
        orderPriority: serviceRequest.priority || 'UNKNOWN',
      },
      patient.id,
      secrets,
      m2mtoken
    );

    return {
      body: JSON.stringify({
        message: 'success',
        example: request,
        url: pdfDetail.uploadURL,
      }),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error submitting a lab order' }),
      statusCode: 500,
    };
  }
};
