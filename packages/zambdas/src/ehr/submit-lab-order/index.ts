import { APIGatewayProxyResult } from 'aws-lambda';
import {
  getPatchBinary,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  getPresignedURL,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  EXTERNAL_LAB_ERROR,
  isApiError,
  APIError,
  DYMO_30334_LABEL_CONFIG,
  getPatientFirstName,
  getPatientLastName,
  isPSCOrder,
  getTimezone,
  allLicensesForPractitioner,
  FHIR_IDENTIFIER_NPI,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch } from '../../shared';
import { ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { Coverage, FhirResource, Location, Organization, Patient, Provenance, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import { createExternalLabsOrderFormPDF } from '../../shared/pdf/external-labs-order-form-pdf';
import { makeLabPdfDocumentReference } from '../../shared/pdf/labs-results-form-pdf';
import { getExternalLabOrderResources } from '../shared/labs';
import { AOEDisplayForOrderForm, populateQuestionnaireResponseItems } from './helpers';
import { BatchInputPatchRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { createExternalLabsLabelPDF, ExternalLabsLabelConfig } from '../../shared/pdf/external-labs-label-pdf';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;
export const LABS_DATE_STRING_FORMAT = 'MM/dd/yyyy hh:mm a ZZZZ';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const {
      serviceRequestID,
      accountNumber,
      data,
      secrets,
      specimens: specimensFromSubmit,
    } = validateRequestParameters(input);

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
      appointment,
      encounter,
      organization: labOrganization,
      specimens: specimenResourses,
    } = await getExternalLabOrderResources(oystehr, serviceRequestID);

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
        throw EXTERNAL_LAB_ERROR('coverage is not found');
      }

      if (organizationsRequestsTemp?.length !== 1) {
        throw EXTERNAL_LAB_ERROR('organization is not found');
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
    let timezone = undefined;

    if (location) {
      timezone = getTimezone(location);
    }

    const sampleCollectionDates: DateTime[] = [];

    const specimenPatchOperations: BatchInputPatchRequest<FhirResource>[] =
      specimenResourses.length > 0
        ? specimenResourses.reduce<BatchInputPatchRequest<FhirResource>[]>((acc, specimen) => {
            if (!specimen.id) {
              return acc;
            }

            // There is an option to edit the date through the update-lab-order-resources zambda as well.
            const specimenFromSubmitDate = specimensFromSubmit?.[specimen.id]?.date
              ? DateTime.fromISO(specimensFromSubmit[specimen.id].date)
              : undefined;
            const specimeCollection = specimen.collection;
            const collectedDateTime = specimeCollection?.collectedDateTime;
            const collector = specimeCollection?.collector;
            const specimenCollector = { reference: currentUser?.profile };
            const requests: Operation[] = [];

            specimenFromSubmitDate && sampleCollectionDates.push(specimenFromSubmitDate);

            if (specimeCollection) {
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
    const preSumbissionWriteRequests = [...specimenPatchOperations];

    // not every order will have an AOE
    let questionsAndAnswers: AOEDisplayForOrderForm[] = [];
    if (questionnaireResponse !== undefined && questionnaireResponse.id) {
      const { questionnaireResponseItems, questionsAndAnswersForFormDisplay } =
        await populateQuestionnaireResponseItems(questionnaireResponse, data, m2mtoken);

      questionsAndAnswers = questionsAndAnswersForFormDisplay;

      preSumbissionWriteRequests.push({
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

    if (preSumbissionWriteRequests.length > 0) {
      console.log('writing updates that must occur before sending order to oysther');
      await oystehr?.fhir.transaction({
        requests: preSumbissionWriteRequests,
      });
    }

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
      console.log('submitLabRequestResponse', submitLabRequestResponse);
      throw EXTERNAL_LAB_ERROR(submitLabRequestResponse.message || 'error submitting lab request to oystehr');
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

    await oystehr?.fhir.transaction({
      requests: [
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

    const orderID = serviceRequestTemp.identifier?.find((item) => item.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)
      ?.value;

    const orderCreateDate = serviceRequest.authoredOn
      ? DateTime.fromISO(serviceRequest.authoredOn).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
      : undefined;

    const ORDER_ITEM_UNKNOWN = 'UNKNOWN';

    const mostRecentSampleCollectionDate =
      sampleCollectionDates.length > 0
        ? sampleCollectionDates.reduce((latest, current) => {
            return current > latest ? current : latest;
          })
        : undefined;

    const allPractitionerLicenses = allLicensesForPractitioner(provider);
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
        serviceRequestID: serviceRequest.id || ORDER_ITEM_UNKNOWN,
        reqId: orderID || ORDER_ITEM_UNKNOWN,
        providerName: provider.name ? oystehr.fhir.formatHumanName(provider.name[0]) : ORDER_ITEM_UNKNOWN,
        // if there are multiple titles, use the first one https://github.com/masslight/ottehr/issues/2184
        providerTitle: allPractitionerLicenses.length ? allPractitionerLicenses[0].code : '',
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
        orderCreateDate: orderCreateDate || ORDER_ITEM_UNKNOWN,
        sampleCollectionDate:
          mostRecentSampleCollectionDate?.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT) || undefined,
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
      },
      patient.id,
      secrets,
      m2mtoken
    );

    await makeLabPdfDocumentReference({
      oystehr,
      type: 'order',
      pdfInfo: orderFormPdfDetail,
      patientID: patient.id,
      encounterID: encounter.id,
      serviceRequestID: serviceRequest.id,
    });

    const presignedOrderFormURL = await getPresignedURL(orderFormPdfDetail.uploadURL, m2mtoken);
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

      presignedLabelURL = (
        await createExternalLabsLabelPDF(labelConfig, encounter.id!, serviceRequest.id!, secrets, m2mtoken, oystehr)
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
    await topLevelCatch('admin-submit-lab-order', error, input.secrets);
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
};
