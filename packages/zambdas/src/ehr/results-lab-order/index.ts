import { APIGatewayProxyResult } from 'aws-lambda';
import { isValidUUID, OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';
import { ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { Location, Practitioner, Provenance } from 'fhir/r4b';
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
      organization,
      observations,
    } = await getLabOrderResources(oystehr, serviceRequestTemp.id);
    console.log(1, observations);
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

    const provenanceRequestTemp = (
      await oystehr.fhir.search({
        resourceType: 'Provenance',
        params: [
          {
            name: '_id',
            value: task.relevantHistory?.[0].reference?.replace('Provenance/', '') || '',
          },
          {
            name: '_include',
            value: 'Provenance:agent',
          },
        ],
      })
    )?.unbundle();

    const taskProvenanceTemp: Provenance[] | undefined = provenanceRequestTemp?.filter(
      (resourceTemp): resourceTemp is Provenance => resourceTemp.resourceType === 'Provenance'
    );
    const taskPractitionersTemp: Practitioner[] | undefined = provenanceRequestTemp?.filter(
      (resourceTemp): resourceTemp is Practitioner => resourceTemp.resourceType === 'Practitioner'
    );

    if (taskProvenanceTemp.length !== 1) {
      throw new Error('provenance is not found');
    }

    if (taskPractitionersTemp.length !== 1) {
      throw new Error('practitioner is not found');
    }

    const taskProvenance = taskProvenanceTemp[0];
    const taskPractitioner = taskPractitionersTemp[0];

    const location: Location = await oystehr.fhir.get({
      resourceType: 'Location',
      id: locationID,
    });

    const now = DateTime.now();
    const orderID = serviceRequestTemp.identifier?.find(
      (item) => item.system === 'https://identifiers.fhir.oystehr.com/lab-order-placer-id'
    )?.value;

    const diagnosticReportOrderID = diagnosticReport.identifier?.find((item) => item.type?.coding?.[0].code === 'FILL')
      ?.value;
    const reviewDate = DateTime.fromISO(taskProvenance.recorded).toFormat('MM/dd/yyyy');
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
        providerNPI:
          provider.identifier?.find((id) => id.system === 'http://hl7.org/fhir/sid/us-npi')?.value ||
          ORDER_RESULT_ITEM_UNKNOWN,
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
        labType:
          serviceRequest.contained
            ?.filter((item) => item.resourceType === 'ActivityDefinition')
            .map((resource) => resource.title)
            .join(', ') || ORDER_RESULT_ITEM_UNKNOWN,
        assessmentCode:
          serviceRequest.reasonCode?.map((code) => code.coding?.[0].code).join(', ') || ORDER_RESULT_ITEM_UNKNOWN,
        assessmentName: serviceRequest.reasonCode?.map((code) => code.text).join(', ') || ORDER_RESULT_ITEM_UNKNOWN,
        accessionNumber: diagnosticReportOrderID || ORDER_RESULT_ITEM_UNKNOWN,
        // orderReceived: '10/10/2024',
        // specimenReceived: '10/10/2024',
        // reportDate: '10/10/2024',
        // specimenSource: 'Throat',
        // specimenDescription: 'Throat culture',
        specimenValue: undefined,
        specimenReferenceRange: undefined,
        resultBody:
          observations.map((observation) => observation.code.coding?.[0].display).join(', ') ||
          ORDER_RESULT_ITEM_UNKNOWN,
        resultPhase: diagnosticReport.status.charAt(0).toUpperCase() || ORDER_RESULT_ITEM_UNKNOWN,
        reviewingProviderFirst: taskPractitioner.name?.[0].given?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
        reviewingProviderLast: taskPractitioner.name?.[0].family || ORDER_RESULT_ITEM_UNKNOWN,
        reviewingProviderTitle: ORDER_RESULT_ITEM_UNKNOWN,
        reviewDate: reviewDate,
        performingLabCode:
          diagnosticReport.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
          diagnosticReport.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code ||
          ORDER_RESULT_ITEM_UNKNOWN,
        performingLabName: organization.name || ORDER_RESULT_ITEM_UNKNOWN,
        performingLabStreetAddress: organization.address?.[0].line?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
        performingLabCity: organization.address?.[0].city || ORDER_RESULT_ITEM_UNKNOWN,
        performingLabState: organization.address?.[0].state || ORDER_RESULT_ITEM_UNKNOWN,
        performingLabZip: organization.address?.[0].postalCode || ORDER_RESULT_ITEM_UNKNOWN,
        performingLabPhone:
          organization.contact
            ?.find((temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director'))
            ?.telecom?.find((temp) => temp.system === 'phone')?.value || ORDER_RESULT_ITEM_UNKNOWN,
        // abnormalResult: true,
        performingLabProviderFirstName:
          organization.contact
            ?.find((temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director'))
            ?.name?.given?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
        performingLabProviderLastName:
          organization.contact?.find(
            (temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director')
          )?.name?.family || ORDER_RESULT_ITEM_UNKNOWN,
        performingLabProviderTitle: ORDER_RESULT_ITEM_UNKNOWN,
        // performingLabDirector: organization.contact?.[0].name
        //   ? oystehr.fhir.formatHumanName(organization.contact?.[0].name)
        //   : ORDER_RESULT_ITEM_UNKNOWN,
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
