import { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  Account,
  ActivityDefinition,
  Communication,
  Coverage,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
  Provenance,
  QuestionnaireResponse,
  Reference,
  ServiceRequest,
  Specimen,
  SpecimenDefinition,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateLabOrderZambdaOutput,
  createOrderNumber,
  EXTERNAL_LAB_ERROR,
  EXTERNAL_LAB_ERROR_MISSING_WC_INFO,
  flattenBundleResources,
  getAttendingPractitionerId,
  getOrderNumber,
  getSecret,
  isPSCOrder,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LAB_CLIENT_BILL_COVERAGE_TYPE_CODING,
  LAB_ORG_TYPE_CODING,
  LabPaymentMethod,
  ORDER_NUMBER_LEN,
  OrderableItemSearchResult,
  OrderableItemSpecimen,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  paymentMethodFromCoverage,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  RELATED_SPECIMEN_DEFINITION_SYSTEM,
  SecretsKeys,
  serviceRequestPaymentMethod,
  SPECIMEN_CODING_CONFIG,
  WORKERS_COMP_SERVICE_REQUEST_CATEGORY,
} from 'utils';
import { checkOrCreateM2MClientToken, getMyPractitionerId, topLevelCatch, wrapHandler } from '../../../../shared';
import { createOystehrClient } from '../../../../shared/helpers';
import { ZambdaInput } from '../../../../shared/types';
import { accountIsPatientBill, accountIsWorkersComp, sortCoveragesByPriority } from '../../shared/labs';
import { labOrderCommunicationType } from '../get-lab-orders/helpers';
import {
  CreateLabCoverageDetails,
  formatClinicalInfoNoteCommunication,
  formatPreSubmissionTaskConfig,
  formatServiceRequestConfig,
  GetCreateOrderResourcesInput,
  GetCreateOrderResourcesReturn,
  groupTestsByLabGuid,
  ResourcesForRequestFormatting,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('create-lab-order', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const {
      dx,
      encounter, // why do we send the whole encounter? can probably just do the id and grab the resource later
      orderableItems,
      psc,
      secrets,
      orderingLocation: modifiedOrderingLocation,
      selectedPaymentMethod,
      clinicalInfoNoteByUser,
    } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    let curUserPractitionerId: string | undefined;
    try {
      curUserPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    } catch {
      throw EXTERNAL_LAB_ERROR(
        'Resource configuration error - user creating this external lab order must have a Practitioner resource linked'
      );
    }
    const currentUserPractitioner = await oystehrCurrentUser.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: curUserPractitionerId,
    });

    console.log('>>> this is the encounter,', JSON.stringify(encounter, undefined, 2));
    const attendingPractitionerId = getAttendingPractitionerId(encounter);

    if (!attendingPractitionerId) {
      // this should never happen since theres also a validation on the front end that you cannot submit without one
      throw EXTERNAL_LAB_ERROR(
        'Resource configuration error - this encounter does not have an attending practitioner linked'
      );
    }

    const clientOrgId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

    const testsGroupedByLabGuid = groupTestsByLabGuid(orderableItems);

    // create lab order requests will come in for the same patient, encounter, psc flag, location
    // the only potential difference is the lab that will perform the test
    const commonResources = {
      encounter,
      psc,
      selectedPaymentMethod,
      oystehr,
      modifiedOrderingLocation,
      clientOrgId,
    };

    const resourceRequestPromises = Object.entries(testsGroupedByLabGuid).map(async ([labGuid, testData]) => {
      // get the fhir resources for this requsition which are grouped by lab
      // (there are some other factors that go into requisition grouping like payment type and psc status but those are will never differ at this point)
      const resources = await getCreateOrderResources({ ...commonResources, labName: testData.labName, labGuid });

      const requisitionNumber = resources.existingOrderNumber || createOrderNumber(ORDER_NUMBER_LEN);

      validateLabOrgAndOrderingLocationAndGetAccountNumber(resources.labOrganization, resources.orderingLocation);

      const orderableItems = testData.tests;

      const requestsForRequsition = orderableItems.map((orderableItem) => {
        const requestsForThisTest = formatAllResourceRequests(orderableItem, {
          ...resources,
          requisitionNumber,
          encounter,
          dx,
          psc,
          attendingPractitionerId,
          clinicalInfoNoteByUser,
          selectedPaymentMethod,
          currentUserPractitioner,
        });
        return requestsForThisTest;
      });

      return requestsForRequsition.flat();
    });

    const resourceRequests = await Promise.all(resourceRequestPromises);

    const requests = resourceRequests.flat();

    console.log('making transaction request', JSON.stringify(requests));
    await oystehr.fhir.transaction({ requests });

    const response: CreateLabOrderZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-create-lab-order', error, ENVIRONMENT);
  }
});

const formatAllResourceRequests = (
  orderableItem: OrderableItemSearchResult,
  resources: ResourcesForRequestFormatting
): BatchInputRequest<FhirResource>[] => {
  const {
    labOrganization,
    patient,
    coverageDetails,
    orderingLocation,
    orderLevelNote,
    requisitionNumber,
    encounter,
    selectedPaymentMethod,
    psc,
    attendingPractitionerId,
    currentUserPractitioner,
    clinicalInfoNoteByUser,
  } = resources;
  console.log(
    `Formatting fhir batch input requests. Requisition: ${requisitionNumber} Test: ${orderableItem.item.itemName} ${orderableItem.item.itemCode} LabGuid: ${orderableItem.lab.labGuid}`
  );

  const requests: BatchInputRequest<FhirResource>[] = [];
  const serviceRequestFullUrl = `urn:uuid:${randomUUID()}`;

  const activityDefinitionToContain = formatActivityDefinitionToContain(orderableItem);
  const serviceRequestContained: FhirResource[] = [];
  const serviceRequestSupportingInfo: Reference[] = [];
  const specimenFullUrlArr: string[] = [];

  const provenanceFullUrl = `urn:uuid:${randomUUID()}`;
  const provenanceConfig = getProvenanceConfig(
    serviceRequestFullUrl,
    orderingLocation.id,
    currentUserPractitioner.id || '',
    attendingPractitionerId
  );
  requests.push({
    method: 'POST',
    url: '/Provenance',
    resource: provenanceConfig,
    fullUrl: provenanceFullUrl,
  });

  const createSpecimenResources = !psc;
  console.log('is psc:', psc);
  console.log('orderableItem.item.specimens.length:', orderableItem.item.specimens.length);
  if (createSpecimenResources) {
    const { specimenDefinitionConfigs, specimenConfigs } = formatSpecimenResources(
      orderableItem,
      patient.id ?? '',
      serviceRequestFullUrl
    );
    activityDefinitionToContain.specimenRequirement = specimenDefinitionConfigs.map((sd) => ({
      reference: `#${sd.id}`,
    }));
    serviceRequestContained.push(activityDefinitionToContain, ...specimenDefinitionConfigs);
    specimenConfigs.forEach((specimenResource) => {
      const specimenFullUrl = `urn:uuid:${randomUUID()}`;
      specimenFullUrlArr.push(specimenFullUrl);
      requests.push({
        method: 'POST',
        url: '/Specimen',
        resource: specimenResource,
        fullUrl: specimenFullUrl,
      });
    });
  } else {
    serviceRequestContained.push(activityDefinitionToContain);
  }

  const aoeQRConfig = formatAoeQR(serviceRequestFullUrl, encounter.id || '', orderableItem);
  if (aoeQRConfig) {
    const aoeQRFullUrl = `urn:uuid:${randomUUID()}`;
    const postQrRequest: BatchInputRequest<QuestionnaireResponse> = {
      method: 'POST',
      url: '/QuestionnaireResponse',
      resource: aoeQRConfig,
      fullUrl: aoeQRFullUrl,
    };
    requests.push(postQrRequest);

    serviceRequestSupportingInfo.push({
      type: 'QuestionnaireResponse',
      reference: aoeQRFullUrl,
    });
  }

  if (clinicalInfoNoteByUser) {
    const communicationFullUrl = `urn:uuid:${randomUUID()}`;
    const communicationConfig = formatClinicalInfoNoteCommunication(
      requisitionNumber,
      serviceRequestFullUrl,
      clinicalInfoNoteByUser
    );
    requests.push({
      method: 'POST',
      url: '/Communication',
      resource: communicationConfig,
      fullUrl: communicationFullUrl,
    });

    serviceRequestSupportingInfo.push({
      type: 'Communication',
      reference: communicationFullUrl,
    });
  }

  if (orderLevelNote) {
    console.log('since an order level note exists for this order, we must add the new service request to its based-on');
    requests.push({
      method: 'PATCH',
      url: `Communication/${orderLevelNote.id}`,
      operations: [{ op: 'add', path: `/basedOn/-`, value: { reference: serviceRequestFullUrl } }],
      ifMatch: orderLevelNote.meta?.versionId ? `W/"${orderLevelNote.meta.versionId}"` : undefined,
    });
  }

  const serviceRequestConfig = formatServiceRequestConfig(
    orderableItem,
    resources,
    serviceRequestContained,
    activityDefinitionToContain.id || '',
    specimenFullUrlArr,
    provenanceFullUrl
  );

  console.log('selected payment method', selectedPaymentMethod);
  if (coverageDetails.type === LabPaymentMethod.Insurance) {
    console.log('assigning serviceRequestConfig.insurance');
    const coverageRefs: Reference[] = coverageDetails.insuranceCoverages.map((coverage) => {
      return {
        reference: `Coverage/${coverage.id}`,
      };
    });
    serviceRequestConfig.insurance = coverageRefs;
  } else if (coverageDetails.type === LabPaymentMethod.ClientBill) {
    const { clientBillCoverage, clientOrg } = coverageDetails;
    if (clientBillCoverage) {
      console.log(`assigning existing client bill coverage to service request config ${clientBillCoverage.id}`);
      serviceRequestConfig.insurance = [{ reference: `Coverage/${clientBillCoverage.id}` }];
    } else if (!clientBillCoverage) {
      console.log('getting config for to create a new client bill coverage');
      const clientBillCoverageConfig = getClientBillCoverageConfig(patient, clientOrg, labOrganization);
      const clientBillCoverageFullUrl = `urn:uuid:${randomUUID()}`;
      const postClientBillCoverageRequest: BatchInputRequest<Coverage> = {
        method: 'POST',
        url: '/Coverage',
        resource: clientBillCoverageConfig,
        fullUrl: clientBillCoverageFullUrl,
      };
      requests.push(postClientBillCoverageRequest);
      serviceRequestConfig.insurance = [{ reference: clientBillCoverageFullUrl }];
    }
  } else if (coverageDetails.type === LabPaymentMethod.WorkersComp) {
    console.log('adding workers comp insurance and category to ServiceRequest');
    serviceRequestConfig.insurance = [{ reference: `Coverage/${coverageDetails.workersCompInsurance.id}` }];
    if (serviceRequestConfig.category) {
      serviceRequestConfig.category.push({ coding: [WORKERS_COMP_SERVICE_REQUEST_CATEGORY] });
    } else {
      serviceRequestConfig.category = [{ coding: [WORKERS_COMP_SERVICE_REQUEST_CATEGORY] }];
    }
  }

  const preSubmissionTaskConfig = formatPreSubmissionTaskConfig(
    resources,
    activityDefinitionToContain,
    serviceRequestFullUrl,
    serviceRequestConfig
  );
  requests.push({
    method: 'POST',
    url: '/Task',
    resource: preSubmissionTaskConfig,
  });

  if (serviceRequestSupportingInfo.length > 0) {
    serviceRequestConfig.supportingInfo = serviceRequestSupportingInfo;
  }

  requests.push({
    method: 'POST',
    url: '/ServiceRequest',
    resource: serviceRequestConfig,
    fullUrl: serviceRequestFullUrl,
  });

  return requests;
};

const formatAoeQR = (
  serviceRequestFullUrl: string,
  encounterId: string,
  orderableItem: OrderableItemSearchResult
): QuestionnaireResponse | undefined => {
  if (!orderableItem.item.aoe) return;
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: orderableItem.item.aoe.url,
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    basedOn: [
      {
        type: 'ServiceRequest',
        reference: serviceRequestFullUrl,
      },
    ],
    status: 'in-progress',
  };
};

const formatActivityDefinitionToContain = (orderableItem: OrderableItemSearchResult): ActivityDefinition => {
  const activityDefinitionConfig: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    id: 'activityDefinitionId',
    status: 'unknown',
    code: {
      coding: [
        {
          system: OYSTEHR_LAB_OI_CODE_SYSTEM,
          code: orderableItem.item.itemCode,
          display: orderableItem.item.itemName,
        },
      ],
    },
    publisher: orderableItem.lab.labName,
    kind: 'ServiceRequest',
    title: orderableItem.item.itemName,
    name: orderableItem.item.uniqueName,
    url: `https://labs-api.zapehr.com/v1/orderableItem?labIds=${orderableItem.lab.labGuid}&itemCodes=${orderableItem.item.itemCode}`,
    version: orderableItem.lab.compendiumVersion,
  };

  return activityDefinitionConfig;
};

const formatSpecimenResources = (
  orderableItem: OrderableItemSearchResult,
  patientID: string,
  serviceRequestFullUrl: string
): { specimenDefinitionConfigs: SpecimenDefinition[]; specimenConfigs: Specimen[] } => {
  const specimenDefinitionConfigs: SpecimenDefinition[] = [];
  const specimenConfigs: Specimen[] = [];

  // facilitates always showing specimen entry on submit page
  // https://github.com/masslight/ottehr/issues/2934
  if (orderableItem.item.specimens.length === 0) {
    const { specimenDefinitionConfig, specimenConfig } = getSpecimenAndSpecimenDefConfig(
      serviceRequestFullUrl,
      patientID,
      0,
      undefined
    );
    specimenDefinitionConfigs.push(specimenDefinitionConfig);
    specimenConfigs.push(specimenConfig);
  } else {
    orderableItem.item.specimens.forEach((specimen, idx) => {
      const { specimenDefinitionConfig, specimenConfig } = getSpecimenAndSpecimenDefConfig(
        serviceRequestFullUrl,
        patientID,
        idx,
        specimen
      );
      specimenDefinitionConfigs.push(specimenDefinitionConfig);
      specimenConfigs.push(specimenConfig);
    });
  }

  return { specimenDefinitionConfigs, specimenConfigs };
};

const getProvenanceConfig = (
  serviceRequestFullUrl: string,
  locationId: string | undefined,
  currentUserId: string,
  attendingPractitionerId: string
): Provenance => {
  const provenanceConfig: Provenance = {
    resourceType: 'Provenance',
    activity: {
      coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
    },
    target: [
      {
        reference: serviceRequestFullUrl,
      },
    ],
    recorded: DateTime.now().toISO(),
    agent: [
      {
        who: { reference: `Practitioner/${currentUserId}` },
        onBehalfOf: { reference: `Practitioner/${attendingPractitionerId}` },
      },
    ],
  };
  if (locationId) provenanceConfig.location = { reference: `Location/${locationId}` };
  return provenanceConfig;
};

const getCreateOrderResources = async (input: GetCreateOrderResourcesInput): Promise<GetCreateOrderResourcesReturn> => {
  const { encounter, psc, selectedPaymentMethod, oystehr, modifiedOrderingLocation, clientOrgId, labName, labGuid } =
    input;

  const labOrganizationSearchRequest: BatchInputRequest<Organization> = {
    method: 'GET',
    url: `/Organization?type=${LAB_ORG_TYPE_CODING.system}|${LAB_ORG_TYPE_CODING.code}&identifier=${OYSTEHR_LAB_GUID_SYSTEM}|${labGuid}`,
  };
  const encounterResourceSearch: BatchInputRequest<Patient | Coverage | Account> = {
    method: 'GET',
    url: `/Encounter?_id=${encounter.id}&_include=Encounter:patient&_revinclude:iterate=Coverage:patient&_revinclude:iterate=Account:patient&_revinclude:iterate=ServiceRequest:encounter&_revinclude:iterate=Communication:based-on`,
  };
  const orderingLocationSearch: BatchInputRequest<Location> = {
    method: 'GET',
    url: `/Location?status=active&_id=${modifiedOrderingLocation.id}`,
  };

  const requests = [labOrganizationSearchRequest, encounterResourceSearch, orderingLocationSearch];

  const paymentMethodIsClientBill = selectedPaymentMethod === LabPaymentMethod.ClientBill;
  if (paymentMethodIsClientBill) {
    const clientOrgSearch: BatchInputRequest<Organization> = {
      method: 'GET',
      url: `/Organization?_id=${clientOrgId}`,
    };
    requests.push(clientOrgSearch);
  }

  console.log('searching for create lab fhir resources');
  const searchResults: Bundle<FhirResource> = await oystehr.fhir.transaction({ requests });

  const labOrganizationSearchResults: Organization[] = [];
  const insuranceCoverageSearchResults: Coverage[] = [];
  const accountSearchResults: Account[] = [];
  const draftServiceRequests: ServiceRequest[] = [];
  const serviceRequestsForBundle: ServiceRequest[] = [];
  const patientSearchResults: Patient[] = [];
  const orderLevelNotes: Communication[] = [];
  const workersCompAccounts: Account[] = [];
  let orderingLocation: Location | undefined = undefined;
  let clientOrg: Organization | undefined = undefined;
  let clientBillCoverage: Coverage | undefined = undefined;
  let workersCompInsurance: Coverage | undefined = undefined;

  const resources = flattenBundleResources<
    Organization | Coverage | Patient | Account | ServiceRequest | Location | Communication
  >(searchResults);

  console.log('parsing resources from search');
  resources.forEach((resource) => {
    if (resource.resourceType === 'Organization') {
      if (resource.id === clientOrgId) {
        clientOrg = resource;
      } else if (resource.identifier?.some((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)) {
        labOrganizationSearchResults.push(resource);
      }
    }
    if (resource.resourceType === 'Coverage' && resource.status === 'active') {
      const paymentMethod = paymentMethodFromCoverage(resource);
      console.log('paymentMethod parsed from coverage when organizing resources', paymentMethod, resource.id);
      if (paymentMethod === LabPaymentMethod.Insurance) {
        insuranceCoverageSearchResults.push(resource);
      } else if (paymentMethod === LabPaymentMethod.ClientBill) {
        const labGuidFromClientBillCoverage = getLabGuidFromClientBillCoverage(resource);
        if (labGuidFromClientBillCoverage === labGuid) {
          if (clientBillCoverage) {
            console.warn(`Warning: multiple active client bill coverages exist for this patient / lab relationship`);
          }
          clientBillCoverage = resource;
        }
      } else if (paymentMethod === LabPaymentMethod.WorkersComp) {
        if (workersCompInsurance) {
          console.warn(`Warning: multiple active workers comp coverages exist for this encounter ${encounter.id}`);
        }
        workersCompInsurance = resource;
      }
    }
    if (resource.resourceType === 'Patient') patientSearchResults.push(resource);
    if (resource.resourceType === 'Account' && resource.status === 'active') {
      if (accountIsPatientBill(resource)) {
        accountSearchResults.push(resource);
      } else if (accountIsWorkersComp(resource)) {
        workersCompAccounts.push(resource);
      }
    }
    if (resource.resourceType === 'Location') {
      if (
        resource.identifier?.some(
          (id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner && id.assigner?.reference
        )
      )
        orderingLocation = resource;
    }
    if (resource.resourceType === 'Communication') {
      const labCommType = labOrderCommunicationType(resource);
      if (labCommType === 'order-level-note') orderLevelNotes.push(resource);
    }
    // we will use these to determine if the current order is able to be bundled with any existing
    // anything past draft status is automatically in a different bundle
    if (resource.resourceType === 'ServiceRequest' && resource.status === 'draft') {
      draftServiceRequests.push(resource);
    }
  });
  console.log('resource parsing complete');

  if (draftServiceRequests.length) {
    console.log(
      `>>>>> checking draft service request array for bundle-able orders (${draftServiceRequests.length} will be reviewed)`
    );
    draftServiceRequests.forEach((sr, idx) => {
      console.log('\n reviewing draft sr at idx', idx);
      // only requests to the same lab that have not yet been submitted will be bundled
      const draftSRFillerLab = sr.performer?.find((org) => org.identifier?.system === OYSTEHR_LAB_GUID_SYSTEM)
        ?.identifier?.value;
      if (draftSRFillerLab === labGuid) {
        const allCoverages = [...insuranceCoverageSearchResults];
        if (clientBillCoverage) allCoverages.push(clientBillCoverage);
        const resourcePaymentMethod = serviceRequestPaymentMethod(sr, allCoverages);
        const paymentMethodMatches = selectedPaymentMethod === resourcePaymentMethod;

        // different payment method selection means the order must be in a different bundle,
        // IN1 (insurance) is shared across all order segments
        if (paymentMethodMatches) {
          const curSrIsPsc = isPSCOrder(sr);
          if (curSrIsPsc === psc) {
            // we bundled psc orders separately, so if the current test being submitted is psc
            // it should only be bundled under the same requisition number if there are other psc orders for this lab
            serviceRequestsForBundle.push(sr);
          }
        } else {
          console.log(`differing payment methods:
          draft sr payment method: ${resourcePaymentMethod}`);
        }
      } else {
        console.log(`differing labs:
          draft sr was submitted to lab: ${draftSRFillerLab}
          lab currently being created is being filled by ${labGuid}`);
      }
    });
    console.log('\n >>>>> done reviewing draft service request array');
  } else {
    console.log('no draft service requests parsed');
  }

  let existingOrderNumber: string | undefined;
  if (serviceRequestsForBundle.length) {
    console.log('grabbing the order number from the first service request in serviceRequestsForBundle');
    existingOrderNumber = getOrderNumber(serviceRequestsForBundle[0]);
  } else {
    console.log('no like orders exist, a new bundle will be created');
  }

  if (accountSearchResults.length !== 1)
    throw EXTERNAL_LAB_ERROR(
      'Please update responsible party information - patient must have one active account record to represent a guarantor to external lab orders'
    );

  const patientAccount = accountSearchResults[0];
  const coveragesSortedByPriority = sortCoveragesByPriority(patientAccount, insuranceCoverageSearchResults);

  const patient = patientSearchResults?.[0];
  if (!patient) {
    throw EXTERNAL_LAB_ERROR(`Patient resource could not be parsed from fhir search for create external lab`);
  }

  const labOrganization = labOrganizationSearchResults?.[0];
  if (!labOrganization) {
    throw EXTERNAL_LAB_ERROR(
      `Organization resource for ${labName} may be misconfigured. No organization found for lab guid ${labGuid}`
    );
  }

  if (!orderingLocation) {
    throw EXTERNAL_LAB_ERROR(`No location found matching selected office Location id ${modifiedOrderingLocation.id}`);
  }

  if (selectedPaymentMethod === LabPaymentMethod.WorkersComp) {
    if (workersCompAccounts.length !== 1) {
      console.log(`Incorrect number of workers comp accounts found: ${workersCompAccounts.length}`);
      throw EXTERNAL_LAB_ERROR_MISSING_WC_INFO(
        `Information necessary to submit labs is missing. Please navigate to visit details and complete all Worker's Compensation Information.`
      );
    }

    if (!workersCompInsurance) {
      console.log(`workersCompInsurance not found for encounter: ${encounter.id}`);
      throw EXTERNAL_LAB_ERROR_MISSING_WC_INFO(
        `Information necessary to submit labs is missing. Please navigate to visit details and complete all Worker's Compensation Information.`
      );
    }

    const workersCompAccount = workersCompAccounts[0];

    console.log('checking that workers comp account is associated with this encounter');
    console.log('workersCompAccount', workersCompAccount.id);
    console.log('encounter.account', JSON.stringify(encounter?.account));

    const encounterHasWorkersCompAccount = !!encounter?.account?.some(
      (ref) => ref.reference === `Account/${workersCompAccount.id}`
    );

    if (!encounterHasWorkersCompAccount) {
      throw new Error(
        `There is a config issue with this encounter. The appointment is tagged as workers comp and the lab payment method selected is workers comp but the wc account is not linked to Encounter/${encounter?.id}.`
      );
    }

    // todo labs oystehr submit lab will throw an error if there is no address under Account.guarantor.party, it would be good to validate that here too
    // we'll need to grab the workersCompAccount organization and check

    const workersCompInsuranceId = (workersCompInsurance as Coverage | undefined)?.id;
    const insuranceMatchesAccount = workersCompAccount.coverage?.some(
      (cov) => cov.coverage.reference === `Coverage/${workersCompInsuranceId}`
    );
    if (!insuranceMatchesAccount) {
      throw new Error(
        `Insurance mismatch on workers comp account: Account/${workersCompAccount.id} Coverage/${workersCompInsuranceId}`
      );
    }
  }

  let coverageDetails: CreateLabCoverageDetails | undefined;
  switch (selectedPaymentMethod) {
    case LabPaymentMethod.ClientBill:
      if (!clientOrg) {
        throw EXTERNAL_LAB_ERROR(
          `Payment method is client bill but no org was found matching the configured client org id: ${clientOrgId}`
        );
      }
      coverageDetails = {
        type: LabPaymentMethod.ClientBill,
        clientBillCoverage,
        clientOrg,
      };
      break;
    case LabPaymentMethod.Insurance:
      if (!coveragesSortedByPriority) {
        throw EXTERNAL_LAB_ERROR(`Payment method is insurance but no insurances were found`);
      }
      coverageDetails = {
        type: LabPaymentMethod.Insurance,
        insuranceCoverages: coveragesSortedByPriority,
      };
      break;
    case LabPaymentMethod.SelfPay:
      coverageDetails = {
        type: LabPaymentMethod.SelfPay,
      };
      break;
    case LabPaymentMethod.WorkersComp:
      if (!workersCompInsurance) {
        throw new Error(`workersCompInsurance not found for encounter: ${encounter.id}`);
      }
      coverageDetails = {
        type: LabPaymentMethod.WorkersComp,
        workersCompInsurance,
      };
      break;
    default:
      throw EXTERNAL_LAB_ERROR(`Unknown selected payment method ${selectedPaymentMethod}`);
  }

  const orderLevelNote = getExistingOrderLevelNote(orderLevelNotes, existingOrderNumber);

  return {
    labOrganization,
    patient,
    coverageDetails,
    existingOrderNumber,
    orderingLocation,
    orderLevelNote,
  };
};

const getSpecimenAndSpecimenDefConfig = (
  serviceRequestFullUrl: string,
  patientID: string,
  idx: number,
  specimen: OrderableItemSpecimen | undefined
): {
  specimenDefinitionConfig: SpecimenDefinition;
  specimenConfig: Specimen;
} => {
  // labs sometimes set container, volume, minimumVolume, storageRequirements, or collectionInstructions to null, so need to coalesce to undefined
  const collectionInstructionsCoding = {
    coding: [
      {
        system: SPECIMEN_CODING_CONFIG.collection.system,
        code: SPECIMEN_CODING_CONFIG.collection.code.collectionInstructions,
      },
    ],
    text: specimen?.collectionInstructions ?? undefined,
  };
  const specimenDefinitionId = `specimenDefinitionId${idx}`;
  const specimenDefinitionConfig: SpecimenDefinition = {
    resourceType: 'SpecimenDefinition',
    id: specimenDefinitionId,
    collection: [
      collectionInstructionsCoding,
      {
        coding: [
          {
            system: SPECIMEN_CODING_CONFIG.collection.system,
            code: SPECIMEN_CODING_CONFIG.collection.code.specimenVolume,
          },
        ],
        text: specimen?.volume ?? undefined,
      },
    ],
    typeTested: [
      {
        preference: 'preferred',
        container:
          !!specimen?.container || !!specimen?.minimumVolume
            ? {
                description: specimen.container ?? undefined,
                minimumVolumeString: specimen.minimumVolume ?? undefined,
              }
            : undefined,
        handling: specimen?.storageRequirements
          ? [
              {
                instruction: specimen.storageRequirements,
              },
            ]
          : undefined,
      },
    ],
  };

  const specimenConfig: Specimen = {
    resourceType: 'Specimen',
    request: [{ reference: serviceRequestFullUrl }],
    collection: {
      method: collectionInstructionsCoding,
    },
    extension: [
      {
        url: RELATED_SPECIMEN_DEFINITION_SYSTEM,
        valueString: specimenDefinitionId,
      },
    ],
    subject: {
      type: 'Patient',
      reference: `Patient/${patientID}`,
    },
  };
  return { specimenDefinitionConfig, specimenConfig };
};

/**
 * Ensures the ordering location is configured to order labs from the Lab Organization determined from the orderable item.
 * If yes, grabs the order location's account number for that Lab Org. Errors otherwise.
 * @param labOrganization
 * @param orderingLocation
 */
function validateLabOrgAndOrderingLocationAndGetAccountNumber(
  labOrganization: Organization,
  orderingLocation: Location
): string {
  console.log('These are the Location identifiers', JSON.stringify(orderingLocation.identifier));
  const orderingLocationLabInfo = orderingLocation.identifier?.find(
    (id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM && id.assigner?.reference === `Organization/${labOrganization.id}`
  );

  if (!orderingLocationLabInfo) {
    console.error(
      `Ordering Location/${orderingLocation.id} is not configured to order labs from Organization/${labOrganization.id}`
    );
    throw EXTERNAL_LAB_ERROR(
      `The '${orderingLocation.name}' location is not configured to order labs from ${labOrganization.name}`
    );
  }

  if (!orderingLocationLabInfo.value) {
    console.error(
      `Ordering Location/${orderingLocation.id} missing account number for Organization/${labOrganization.id}`
    );
    throw EXTERNAL_LAB_ERROR(
      `No account number found for ${labOrganization.name} for the ${orderingLocation.name} location`
    );
  }

  return orderingLocationLabInfo.value;
}

function getClientBillCoverageConfig(patient: Patient, clientOrg: Organization, labOrg: Organization): Coverage {
  const clientBillCoverageConfig: Coverage = {
    resourceType: 'Coverage',
    status: 'active',
    beneficiary: {
      reference: `Patient/${patient.id}`,
    },
    subscriber: {
      reference: `Patient/${patient.id}`,
    },
    type: { coding: [LAB_CLIENT_BILL_COVERAGE_TYPE_CODING] },
    payor: [
      {
        reference: `Organization/${clientOrg.id}`,
      },
    ],
    policyHolder: {
      reference: `Organization/${labOrg.id}`,
      identifier: {
        system: OYSTEHR_LAB_GUID_SYSTEM,
        value: labOrg.identifier?.find((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)?.value,
      },
    },
  };
  return clientBillCoverageConfig;
}

function getLabGuidFromClientBillCoverage(coverage: Coverage): string | undefined {
  const clientBillCoverageIdentifier = coverage.policyHolder?.identifier;
  let labGuidFromClientBillCoverage: string | undefined;
  if (clientBillCoverageIdentifier?.system === OYSTEHR_LAB_GUID_SYSTEM) {
    labGuidFromClientBillCoverage = clientBillCoverageIdentifier.value;
  }
  return labGuidFromClientBillCoverage;
}

const getExistingOrderLevelNote = (
  orderLevelNotes: Communication[] | undefined,
  existingOrderNumber: string | undefined
): Communication | undefined => {
  if (!orderLevelNotes || !existingOrderNumber) return;

  console.log(
    'checking communications for an order level note linked to this existing order number',
    existingOrderNumber
  );
  const notesForThisOrder = orderLevelNotes.filter(
    (comm) =>
      comm.identifier?.find(
        (id) => id.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM && id.value === existingOrderNumber
      )
  );
  console.log('number of notesForThisOrder found', notesForThisOrder.length);
  if (notesForThisOrder.length === 0) return;
  if (notesForThisOrder.length > 1) {
    throw new Error(
      `Resources for this bundle are misconfigured. More than one order level note exists. These are the Ids: ${notesForThisOrder.map(
        (comm) => `Communication/${comm.id}`
      )}`
    );
  }
  return notesForThisOrder[0];
};
