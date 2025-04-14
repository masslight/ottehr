import { APIGatewayProxyResult } from 'aws-lambda';
import { isValidUUID } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';
import { ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { Location } from 'fhir/r4b';
import { getLabOrderResources } from '../shared/labs';
import {
  createExternalLabsResultsFormPDF,
  makeLabPdfDocumentReference,
} from '../../shared/pdf/external-labs-results-form-pdf';
import { DateTime } from 'luxon';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequest: serviceRequestTemp, secrets } = validateRequestParameters(input);

    if (!serviceRequestTemp.id) {
      throw new Error('serviceRequest id is not defined');
    }

    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    console.log('token', m2mtoken);

    const oystehr = createOystehrClient(m2mtoken, secrets);

    const {
      serviceRequest,
      patient,
      practitioner: provider,
      questionnaireResponse,
      task,
      diagnosticReport,
      appointment,
      encounter,
    } = await getLabOrderResources(oystehr, serviceRequestTemp.id);
    const locationID = serviceRequest.locationReference?.[0].reference?.replace('Location/', '');

    if (!appointment.id) {
      throw new Error('appointment id is undefined');
    }

    if (!encounter.id) {
      throw new Error('encounter id is undefined');
    }

    if (!locationID || !isValidUUID(locationID)) {
      throw new Error(`location id ${locationID} is not a uuid`);
    }

    if (!patient.id) {
      throw new Error('patient.id is undefined');
    }

    if (!diagnosticReport) {
      throw new Error('diagnostic report is undefined');
    }

    const location: Location = await oystehr.fhir.get({
      resourceType: 'Location',
      id: locationID,
    });

    const now = DateTime.now();
    const orderID = serviceRequestTemp.identifier?.find(
      (item) => item.system === 'https://identifiers.fhir.oystehr.com/lab-order-placer-id'
    )?.value;
    console.log(5, diagnosticReport);
    exit();
    const diagnosticReportOrderID = diagnosticReport.identifier?.find((item) => item.type?.coding?.[0].code === 'FILL')
      ?.value;
    const ORDER_RESULT_ITEM_UNKNOWN = 'UNKNOWN';

    const pdfDetail = await createExternalLabsResultsFormPDF(
      {
        locationName: location.name || ORDER_RESULT_ITEM_UNKNOWN,
        locationStreetAddress: location.address?.line?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
        locationCity: location.address?.city || ORDER_RESULT_ITEM_UNKNOWN,
        locationState: location.address?.state || ORDER_RESULT_ITEM_UNKNOWN,
        locationZip: location.address?.postalCode || ORDER_RESULT_ITEM_UNKNOWN,
        locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value || ORDER_RESULT_ITEM_UNKNOWN,
        locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value || ORDER_RESULT_ITEM_UNKNOWN,
        reqId: orderID || ORDER_RESULT_ITEM_UNKNOWN,
        providerName: provider.name ? oystehr.fhir.formatHumanName(provider.name[0]) : ORDER_RESULT_ITEM_UNKNOWN,
        providerTitle:
          provider.qualification?.map((qualificationTemp) => qualificationTemp.code.text).join(', ') ||
          ORDER_RESULT_ITEM_UNKNOWN,
        providerNPI: 'test',
        patientFirstName: patient.name?.[0].given?.[0] || ORDER_RESULT_ITEM_UNKNOWN,
        patientMiddleName: patient.name?.[0].given?.[1] || '',
        patientLastName: patient.name?.[0].family || ORDER_RESULT_ITEM_UNKNOWN,
        patientSex: patient.gender || ORDER_RESULT_ITEM_UNKNOWN,
        patientDOB: patient.birthDate
          ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
          : ORDER_RESULT_ITEM_UNKNOWN,
        patientId: patient.id,
        patientAddress: patient.address?.[0]
          ? oystehr.fhir.formatAddress(patient.address[0])
          : ORDER_RESULT_ITEM_UNKNOWN,
        patientPhone: patient.telecom?.[0].value || ORDER_RESULT_ITEM_UNKNOWN,
        todayDate: now.toFormat('MM/dd/yy hh:mm a'),
        orderDate: now.toFormat('MM/dd/yy hh:mm a'),
        orderPriority: serviceRequest.priority || ORDER_RESULT_ITEM_UNKNOWN,
        labType: 'Culture, throat',
        assessmentCode: '-J02.9',
        assessmentName: 'Sore throat',
        accessionNumber: diagnosticReportOrderID || ORDER_RESULT_ITEM_UNKNOWN,
        orderReceived: '10/10/2024',
        specimenReceived: '10/10/2024',
        reportDate: '10/10/2024',
        specimenSource: 'Throat',
        Dx: 'Sore throat',
        specimenDescription: 'Throat culture',
        specimenValue: 'Positive',
        specimenReferenceRange: 'Negative',
        resultBody:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla augue lorem, fermentum placerat iaculis ut, dapibus at odio. In tempor lacus vel nulla ultrices mattis. Sed sed nunc mattis, eleifend ipsum id, dapibus neque. Vivamus mattis non lacus nec feugiat. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.',
        resultPhase: 'F',
        reviewingProviderFirst: 'Sally',
        reviewingProviderLast: 'Mink',
        reviewingProviderTitle: 'Dr.',
        reviewDate: '10/10/2024',
        performingLabCode: '123456',
        performingLabName: 'MedFusion',
        performingLabStreetAddress: '123 Example Address',
        performingLabCity: 'Example City',
        performingLabState: 'EX',
        performingLabZip: '12345',
        performingLabPhone: '123 456 7890',
        abnormalResult: true,
        performingLabProviderFirstName: 'John',
        performingLabProviderLastName: 'Smith',
        performingLabProviderTitle: 'MD',
        performingLabDirector: 'Dr. White',
        orderName: '',
      },
      patient.id,
      secrets,
      m2mtoken
    );

    await makeLabPdfDocumentReference(
      oystehr,
      'results',
      pdfDetail,
      patient.id,
      appointment.id,
      encounter.id,
      undefined
    );

    return {
      body: JSON.stringify({
        message: 'success',
        url: pdfDetail.uploadURL,
      }),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    console.log('submit lab order error:', JSON.stringify(error));
    return {
      body: JSON.stringify({ message: 'Error submitting a lab order' }),
      statusCode: 500,
    };
  }
};
