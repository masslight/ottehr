import { BatchInputPatchRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Coverage, FhirResource, Location, Organization, Patient, Provenance, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  APIError,
  DYMO_30334_LABEL_CONFIG,
  EXTERNAL_LAB_ERROR,
  FHIR_IDENTIFIER_NPI,
  getFullestAvailableName,
  getPatchBinary,
  getPatientFirstName,
  getPatientLastName,
  getPresignedURL,
  getSecret,
  getTimezone,
  isApiError,
  isPSCOrder,
  ORDER_NUMBER_LEN,
  ORDER_SUBMITTED_MESSAGE,
  OTTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createExternalLabsLabelPDF, ExternalLabsLabelConfig } from '../../shared/pdf/external-labs-label-pdf';
import { createExternalLabsOrderFormPDF } from '../../shared/pdf/external-labs-order-form-pdf';
import { makeLabPdfDocumentReference } from '../../shared/pdf/labs-results-form-pdf';
import { getExternalLabOrderResources } from '../shared/labs';
import { AOEDisplayForOrderForm, createOrderNumber, populateQuestionnaireResponseItems } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'submit-lab-order';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
export const LABS_DATE_STRING_FORMAT = 'MM/dd/yyyy hh:mm a ZZZZ';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const {
      serviceRequestID,
      accountNumber,
      manualOrder,
      data,
      secrets,
      specimens: specimensFromSubmit,
    } = validateRequestParameters(input);
    console.log('manualOrder', serviceRequestID, manualOrder);

    console.log('Getting token');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    console.log('token', m2mToken);

    const oystehr = createOystehrClient(m2mToken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const currentUser = await createOystehrClient(userToken, secrets).user.me();

    console.log('getting resources needed for submit lab');
    const {
      serviceRequest,
      patient,
      practitioner: provider,
      questionnaireResponse,
      task,
      appointment,
      encounter,
      schedule,
      organization: labOrganization,
      specimens: specimenResources,
    } = await getExternalLabOrderResources(oystehr, serviceRequestID);
    console.log('submit lab resources retrieved');

    // if the serviceRequest already has an order number it has already been submitted,
    // either electronically to the lab (system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)
    // or manually by just printing the order form (system === OTTEHR_LAB_ORDER_PLACER_ID_SYSTEM)
    const orderNumber = serviceRequest.identifier?.find(
      (id) => id.system === OTTEHR_LAB_ORDER_PLACER_ID_SYSTEM || id.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM
    )?.value;
    if (orderNumber) throw EXTERNAL_LAB_ERROR(ORDER_SUBMITTED_MESSAGE);

    const locationID = serviceRequest.locationReference?.[0].reference?.replace('Location/', '');

    if (!appointment.id) {
      throw EXTERNAL_LAB_ERROR('appointment id is undefined');
    }
    if (!encounter.id) {
      throw EXTERNAL_LAB_ERROR('encounter id is undefined');
    }
    if (!serviceRequest.reasonCode) {
      throw EXTERNAL_LAB_ERROR(
        `Please ensure at least one diagnosis is recorded for this service request, ServiceRequest/${serviceRequest.id}, it should be recorded in serviceRequest.reasonCode`
      );
    }
    if (!patient.id) {
      throw EXTERNAL_LAB_ERROR('patient id is undefined');
    }

    let location: Location | undefined;
    if (locationID) {
      location = await oystehr.fhir.get<Location>({
        resourceType: 'Location',
        id: locationID,
      });
    }

    let coverage: Coverage | undefined = undefined;
    let organization: Organization | undefined = undefined;
    let coveragePatient: Patient | undefined = undefined;

    if (serviceRequest.insurance && serviceRequest.insurance?.length > 0) {
      const coverageId = serviceRequest.insurance?.[0].reference?.replace('Coverage/', '');
      console.log('searching for coverage resource', coverageId);
      const insuranceRequestTemp = (
        await oystehr.fhir.search<Patient | Coverage | Organization>({
          resourceType: 'Coverage',
          params: [
            {
              name: '_id',
              value: coverageId || 'UNKNOWN',
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
        throw EXTERNAL_LAB_ERROR('coverage is not found');
      }

      if (organizationsRequestsTemp?.length !== 1) {
        throw EXTERNAL_LAB_ERROR('organization for insurance is not found');
      }

      if (patientsRequestsTemp?.length !== 1) {
        throw EXTERNAL_LAB_ERROR('patient is not found');
      }

      coverage = coveragesRequestsTemp[0];
      organization = organizationsRequestsTemp[0];
      coveragePatient = patientsRequestsTemp[0];

      if (coveragePatient.id !== patient.id) {
        throw EXTERNAL_LAB_ERROR(
          `the patient check with coverage isn't the same as the patient the order is being requested on behalf of, coverage patient ${coveragePatient.id}, patient ${patient.id}`
        );
      }
    }

    const now = DateTime.now();
    let timezone;
    if (schedule) {
      timezone = getTimezone(schedule);
    }
    console.log('timezone found', timezone);

    const sampleCollectionDates: DateTime[] = [];

    const specimenPatchOperations: BatchInputPatchRequest<FhirResource>[] =
      specimenResources.length > 0
        ? specimenResources.reduce<BatchInputPatchRequest<FhirResource>[]>((acc, specimen) => {
            if (!specimen.id) {
              return acc;
            }

            // There is an option to edit the date through the update-lab-order-resources zambda as well.
            const specimenFromSubmitDate = specimensFromSubmit?.[specimen.id]?.date
              ? DateTime.fromISO(specimensFromSubmit[specimen.id].date)
              : undefined;
            const specimenCollection = specimen.collection;
            const collectedDateTime = specimenCollection?.collectedDateTime;
            const collector = specimenCollection?.collector;
            const specimenCollector = { reference: currentUser?.profile };
            const requests: Operation[] = [];

            if (specimenFromSubmitDate) {
              sampleCollectionDates.push(specimenFromSubmitDate);
            }

            if (specimenCollection) {
              console.log('specimen collection found');
              requests.push(
                {
                  path: '/collection/collectedDateTime',
                  op: collectedDateTime ? 'replace' : 'add',
                  value: specimenFromSubmitDate,
                },
                {
                  path: '/collection/collector',
                  op: collector ? 'replace' : 'add',
                  value: specimenCollector,
                }
              );
            } else {
              console.log('adding collection to specimen');
              requests.push({
                path: '/collection',
                op: 'add',
                value: {
                  collectedDateTime: specimenFromSubmitDate,
                  collector: specimenCollector,
                },
              });
            }

            if (requests.length) {
              console.log('will patch specimen resource', specimen.id);
              acc.push({
                method: 'PATCH',
                url: `Specimen/${specimen.id}`,
                operations: requests,
              });
            }

            return acc;
          }, [])
        : [];

    // Specimen.collection.collected is required at time of order so we must make this patch before submitting to oystehr
    const preSubmissionWriteRequests = [...specimenPatchOperations];

    // not every order will have an AOE
    let questionsAndAnswers: AOEDisplayForOrderForm[] = [];
    if (questionnaireResponse !== undefined && questionnaireResponse.id) {
      const { questionnaireResponseItems, questionsAndAnswersForFormDisplay } =
        await populateQuestionnaireResponseItems(questionnaireResponse, data, m2mToken);

      questionsAndAnswers = questionsAndAnswersForFormDisplay;

      console.log('adding patch questionnaire response request to pre-submission write requests');
      preSubmissionWriteRequests.push({
        method: 'PATCH',
        url: `QuestionnaireResponse/${questionnaireResponse.id}`,
        operations: [
          {
            op: 'add',
            path: '/item',
            value: questionnaireResponseItems,
          },
          {
            op: 'replace',
            path: '/status',
            value: 'completed',
          },
        ],
      });
    }

    if (preSubmissionWriteRequests.length > 0) {
      console.log('writing updates that must occur before sending order to oystehr');
      await oystehr?.fhir.transaction({
        requests: preSubmissionWriteRequests,
      });
    }

    // submit to oystehr labs when NOT manual order
    if (!manualOrder) {
      console.log('calling oystehr submit lab');
      const submitLabRequest = await fetch('https://labs-api.zapehr.com/v1/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${m2mToken}`,
        },
        body: JSON.stringify({
          serviceRequest: `ServiceRequest/${serviceRequest.id}`,
          accountNumber: accountNumber,
        }),
      });

      if (!submitLabRequest.ok) {
        const submitLabRequestResponse = await submitLabRequest.json();
        console.log('submitLabRequestResponse', submitLabRequestResponse);
        throw EXTERNAL_LAB_ERROR(submitLabRequestResponse.message || 'error submitting lab request to oystehr');
      }
    }

    // submitted successful, so do the fhir provenance writes and update SR
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
      activity: {
        coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.submit],
      },
    };

    const serviceRequestPatchOps: Operation[] = [
      {
        path: '/status',
        op: 'replace',
        value: 'active',
      },
    ];
    let manualOrderId: string | undefined;
    if (manualOrder) {
      manualOrderId = createOrderNumber(ORDER_NUMBER_LEN);
      console.log('adding order number for manual lab', manualOrderId);
      serviceRequestPatchOps.push({
        path: '/identifier',
        op: 'add',
        value: [
          {
            system: OTTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
            value: manualOrderId,
          },
        ],
      });
    }

    console.log('making fhir transaction requests');
    await oystehr?.fhir.transaction({
      requests: [
        getPatchBinary({
          resourceType: 'ServiceRequest',
          resourceId: serviceRequest.id || 'unknown',
          patchOperations: serviceRequestPatchOps,
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
            {
              op: 'replace',
              path: '/status',
              value: 'completed',
            },
          ],
        }),
      ],
    });

    const serviceRequestTemp: ServiceRequest = await oystehr.fhir.get({
      resourceType: 'ServiceRequest',
      id: serviceRequestID,
    });

    const orderID = manualOrderId
      ? manualOrderId
      : serviceRequestTemp.identifier?.find((item) => item.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)?.value;

    console.log('orderID', serviceRequestID, orderID);

    const orderCreateDate = serviceRequest.authoredOn
      ? DateTime.fromISO(serviceRequest.authoredOn).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
      : undefined;

    const ORDER_ITEM_UNKNOWN = 'UNKNOWN';

    const mostRecentSampleCollectionDate =
      sampleCollectionDates.length > 0
        ? sampleCollectionDates.reduce((latest, current) => {
            return current < latest ? current : latest;
          })
        : undefined;

    // this is the same logic we use in oystehr to determine PV1-20
    const coverageType = coverage?.type?.coding?.[0]?.code; // assumption: we'll use the first code in the list
    const billClass = !coverage || coverageType === 'pay' ? 'Patient Bill (P)' : 'Third-Party Bill (T)';

    console.log('creating external lab order form');
    const orderFormPdfDetail = await createExternalLabsOrderFormPDF(
      {
        locationName: location?.name,
        locationStreetAddress: location?.address?.line?.join(','),
        locationCity: location?.address?.city,
        locationState: location?.address?.state,
        locationZip: location?.address?.postalCode,
        locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value,
        locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value,
        labOrganizationName: labOrganization?.name || ORDER_ITEM_UNKNOWN,
        accountNumber,
        serviceRequestID: serviceRequest.id || ORDER_ITEM_UNKNOWN,
        orderNumber: orderID || ORDER_ITEM_UNKNOWN,
        providerName: getFullestAvailableName(provider) || ORDER_ITEM_UNKNOWN,
        providerNPI: provider.identifier?.find((id) => id?.system === FHIR_IDENTIFIER_NPI)?.value,
        patientFirstName: patient.name?.[0].given?.[0] || ORDER_ITEM_UNKNOWN,
        patientMiddleName: patient.name?.[0].given?.[1],
        patientLastName: patient.name?.[0].family || ORDER_ITEM_UNKNOWN,
        patientSex: patient.gender || ORDER_ITEM_UNKNOWN,
        patientDOB: patient.birthDate
          ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
          : ORDER_ITEM_UNKNOWN,
        patientId: patient.id,
        patientAddress: patient.address?.[0] ? oystehr.fhir.formatAddress(patient.address[0]) : ORDER_ITEM_UNKNOWN,
        patientPhone: patient.telecom?.find((temp) => temp.system === 'phone')?.value || ORDER_ITEM_UNKNOWN,
        todayDate: now.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
        orderSubmitDate: now.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
        orderCreateDateAuthoredOn: serviceRequest.authoredOn || '',
        orderCreateDate: orderCreateDate || ORDER_ITEM_UNKNOWN,
        sampleCollectionDate:
          mostRecentSampleCollectionDate?.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT) || undefined,
        billClass,
        primaryInsuranceName: organization?.name,
        primaryInsuranceAddress: organization?.address
          ? oystehr.fhir.formatAddress(organization.address?.[0])
          : undefined,
        primaryInsuranceSubNum: coverage?.subscriberId,
        insuredName: coveragePatient?.name ? oystehr.fhir.formatHumanName(coveragePatient.name[0]) : undefined,
        insuredAddress: coveragePatient?.address ? oystehr.fhir.formatAddress(coveragePatient.address?.[0]) : undefined,
        aoeAnswers: questionsAndAnswers,
        orderName:
          serviceRequest.code?.coding?.find((coding) => coding.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display ||
          ORDER_ITEM_UNKNOWN,
        orderAssessments: serviceRequest.reasonCode?.map((code) => ({
          code: code.coding?.[0].code || ORDER_ITEM_UNKNOWN,
          name: code.text || ORDER_ITEM_UNKNOWN,
        })),
        orderPriority: serviceRequest.priority || ORDER_ITEM_UNKNOWN,
        isManualOrder: manualOrder,
        isPscOrder: isPSCOrder(serviceRequest),
      },
      patient.id,
      secrets,
      m2mToken
    );

    console.log('making lab pdf document reference');
    await makeLabPdfDocumentReference({
      oystehr,
      type: 'order',
      pdfInfo: orderFormPdfDetail,
      patientID: patient.id,
      encounterID: encounter.id,
      serviceRequestID: serviceRequest.id,
    });

    const presignedOrderFormURL = await getPresignedURL(orderFormPdfDetail.uploadURL, m2mToken);
    let presignedLabelURL: string | undefined = undefined;

    if (!isPSCOrder(serviceRequest)) {
      const labelConfig: ExternalLabsLabelConfig = {
        labelConfig: DYMO_30334_LABEL_CONFIG,
        content: {
          patientId: patient.id!,
          patientFirstName: getPatientFirstName(patient) ?? '',
          patientLastName: getPatientLastName(patient) ?? '',
          patientDateOfBirth: patient.birthDate ? DateTime.fromISO(patient.birthDate) : undefined,
          sampleCollectionDate: mostRecentSampleCollectionDate,
          orderNumber: orderID ?? '',
          accountNumber,
        },
      };

      console.log('creating labs order label and getting url');
      presignedLabelURL = (
        await createExternalLabsLabelPDF(labelConfig, encounter.id!, serviceRequest.id!, secrets, m2mToken, oystehr)
      ).presignedURL;
    }

    return {
      body: JSON.stringify({
        orderPdfUrl: presignedOrderFormURL,
        labelPdfUrl: presignedLabelURL,
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log(error);
    console.log('submit external lab order error:', JSON.stringify(error));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-submit-lab-order', error, ENVIRONMENT);
    let body = JSON.stringify({ message: 'Error submitting external lab order' });
    if (isApiError(error)) {
      const { code, message } = error as APIError;
      body = JSON.stringify({ message, code });
    }
    return {
      statusCode: 500,
      body,
    };
  }
});
