import { APIGatewayProxyResult } from 'aws-lambda';
import { getPatchBinary, isValidUUID } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';
import { ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import {
  Coverage,
  Location,
  Organization,
  Patient,
  Provenance,
  Questionnaire,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  ServiceRequest,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import { getLabOrderResources } from '../shared/labs';
import { createExternalLabsOrderFormPDF } from '../../shared/pdf/external-labs-order-form-pdf';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequestID, accountNumber, data, secrets } = validateRequestParameters(input);

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
    const locationID = serviceRequest.locationReference?.[0].reference?.replace('Location/', '');

    if (!locationID || !isValidUUID(locationID)) {
      throw new Error(`location id ${locationID} is not a uuid`);
    }

    const location: Location = await oystehr.fhir.get({
      resourceType: 'Location',
      id: locationID,
    });
    let coverage: Coverage | undefined = undefined;
    let organization: Organization | undefined = undefined;
    let coveragePatient: Patient | undefined = undefined;
    if (serviceRequest.insurance && serviceRequest.insurance?.length > 0) {
      const insuranceRequestTemp = (
        await oystehr.fhir.search<Patient | Coverage | Organization>({
          resourceType: 'Coverage',
          params: [
            {
              name: '_id',
              value: serviceRequest.insurance?.[0].reference?.replace('Coverage/', '') || 'UNKNOWN',
            },
            {
              name: '_include',
              value: 'Coverage:payor',
            },
            {
              name: '_include',
              value: 'Coverage:beneficiary',
            },
          ],
        })
      )?.unbundle();

      const coveragesRequestsTemp: Coverage[] | undefined = insuranceRequestTemp?.filter(
        (resourceTemp): resourceTemp is Coverage => resourceTemp.resourceType === 'Coverage'
      );
      const organizationsRequestsTemp: Organization[] | undefined = insuranceRequestTemp?.filter(
        (resourceTemp): resourceTemp is Organization => resourceTemp.resourceType === 'Organization'
      );
      const patientsRequestsTemp: Patient[] | undefined = insuranceRequestTemp?.filter(
        (resourceTemp): resourceTemp is Patient => resourceTemp.resourceType === 'Patient'
      );
      if (coveragesRequestsTemp?.length !== 1) {
        throw new Error('coverage is not found');
      }
      if (organizationsRequestsTemp?.length !== 1) {
        throw new Error('organization is not found');
      }
      if (patientsRequestsTemp?.length !== 1) {
        throw new Error('patient is not found');
      }
      coverage = coveragesRequestsTemp[0];
      organization = organizationsRequestsTemp[0];
      coveragePatient = patientsRequestsTemp[0];
      if (coveragePatient.id !== patient.id) {
        throw new Error(
          `the patient check with coverage isn't the same as the patient the order is being requested on behalf of, coverage patient ${coveragePatient.id}, patient ${patient.id}`
        );
      }
    }
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
    const questionsAndAnswers: { question: string; answer: any }[] = [];
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
        answer = data[questionResponse].map((item: string) => ({ valueString: item }));
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
      questionsAndAnswers.push({ question: question.text || 'UNKNOWN', answer: data[questionResponse] || 'UNKNOWN' });
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
        accountNumber: accountNumber,
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
    const ORDER_ITEM_UNKNOWN = 'UNKNOWN';

    const pdfDetail = await createExternalLabsOrderFormPDF(
      {
        locationName: location.name || ORDER_ITEM_UNKNOWN,
        locationStreetAddress: location.address?.line?.join(',') || ORDER_ITEM_UNKNOWN,
        locationCity: location.address?.city || ORDER_ITEM_UNKNOWN,
        locationState: location.address?.state || ORDER_ITEM_UNKNOWN,
        locationZip: location.address?.postalCode || ORDER_ITEM_UNKNOWN,
        locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value || ORDER_ITEM_UNKNOWN,
        locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value || ORDER_ITEM_UNKNOWN,
        reqId: orderID || ORDER_ITEM_UNKNOWN,
        providerName: provider.name ? oystehr.fhir.formatHumanName(provider.name[0]) : ORDER_ITEM_UNKNOWN,
        providerTitle:
          provider.qualification?.map((qualificationTemp) => qualificationTemp.code.text).join(', ') ||
          ORDER_ITEM_UNKNOWN,
        providerNPI: 'test',
        patientFirstName: patient.name?.[0].given?.[0] || ORDER_ITEM_UNKNOWN,
        patientMiddleName: patient.name?.[0].given?.[1] || '',
        patientLastName: patient.name?.[0].family || ORDER_ITEM_UNKNOWN,
        patientSex: patient.gender || ORDER_ITEM_UNKNOWN,
        patientDOB: patient.birthDate
          ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
          : ORDER_ITEM_UNKNOWN,
        patientId: patient.id,
        patientAddress: patient.address?.[0] ? oystehr.fhir.formatAddress(patient.address[0]) : ORDER_ITEM_UNKNOWN,
        patientPhone: patient.telecom?.[0].value || ORDER_ITEM_UNKNOWN,
        todayDate: now.toFormat('MM/dd/yy hh:mm a'),
        orderDate: now.toFormat('MM/dd/yy hh:mm a'),
        primaryInsuranceName: organization?.name,
        primaryInsuranceAddress: organization?.address
          ? oystehr.fhir.formatAddress(organization.address?.[0])
          : undefined,
        primaryInsuranceSubNum: coverage?.subscriberId,
        insuredName: coveragePatient?.name ? oystehr.fhir.formatHumanName(coveragePatient.name[0]) : undefined,
        insuredAddress: coveragePatient?.address ? oystehr.fhir.formatAddress(coveragePatient.address?.[0]) : undefined,
        aoeAnswers: questionsAndAnswers,
        orderName:
          serviceRequest.code?.coding?.map((codingTemp) => codingTemp.display).join(', ') || ORDER_ITEM_UNKNOWN,
        assessmentCode:
          serviceRequest.reasonCode
            ?.map((reasonTemp) => reasonTemp.coding?.map((codingTemp) => codingTemp.code).join(', '))
            .join(', ') || ORDER_ITEM_UNKNOWN,
        assessmentName:
          serviceRequest.reasonCode
            ?.map((reasonTemp) => reasonTemp.coding?.map((codingTemp) => codingTemp.display).join(', '))
            .join(', ') || ORDER_ITEM_UNKNOWN,
        orderPriority: serviceRequest.priority || ORDER_ITEM_UNKNOWN,
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
    console.log('submit lab order error:', JSON.stringify(error));
    return {
      body: JSON.stringify({ message: 'Error submitting a lab order' }),
      statusCode: 500,
    };
  }
};
