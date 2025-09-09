import Oystehr, { BatchInput, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import {
  CodeableConcept,
  FhirResource,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Patient,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getMedicationName,
  getMedicationTypeCode,
  getPatchBinary,
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  INVENTORY_MEDICATION_TYPE_CODE,
  mapFhirToOrderStatus,
  mapOrderStatusToFhir,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MedicationData,
  MedicationInteractions,
  MedicationOrderStatusesType,
  OrderPackage,
  replaceOperation,
  searchMedicationLocation,
  searchRouteByCode,
  UpdateMedicationOrderInput,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import {
  createMedicationAdministrationResource,
  createMedicationRequest,
  createMedicationStatementResource,
} from './fhir-resources-creation';
import {
  createMedicationCopy,
  getMedicationById,
  getMedicationFromMA,
  practitionerIdFromZambdaInput,
  updateMedicationAdministrationData,
  validateProviderAccess,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'create-update-medication-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const practitionerId = await practitionerIdFromZambdaInput(input, validatedParameters.secrets);
    console.log('Created zapToken, fhir and clients.');

    const response = await performEffect(oystehr, validatedParameters, practitionerId);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating/updating order: ${JSON.stringify(error)}` }),
    };
  }
});

async function performEffect(
  oystehr: Oystehr,
  params: UpdateMedicationOrderInput,
  practitionerIdCalledZambda: string
): Promise<any> {
  const { orderId, newStatus, orderData } = params;
  if (orderId && orderData) {
    await updateOrder(oystehr, orderId, newStatus, orderData, params.interactions, practitionerIdCalledZambda);
    return {
      message: 'Order was updated successfully',
      id: orderId,
    };
  } else if (orderId && newStatus) {
    const orderResources = await getOrderResources(oystehr, orderId);
    if (!orderResources) throw new Error(`No order found with id: ${orderId}`);
    await changeOrderStatus(oystehr, orderResources, newStatus);
    return {
      message: 'Order status was changed successfully',
      id: orderId,
    };
  } else if (orderData) {
    const medicationAdministrationId = await createOrder(
      oystehr,
      orderData,
      params.interactions,
      practitionerIdCalledZambda
    );
    return {
      message: 'Order was created successfully',
      id: medicationAdministrationId,
    };
  }
  return { message: 'No action was made because no orderId or orderData was provided' };
}

async function updateOrder(
  oystehr: Oystehr,
  orderId: string,
  newStatus: MedicationOrderStatusesType | undefined,
  orderData: MedicationData,
  interactions: MedicationInteractions | undefined,
  practitionerIdCalledZambda: string
): Promise<any> {
  console.log('updateOrder');

  const orderResources = await getOrderResources(oystehr, orderId);
  if (!orderResources) throw new Error(`No order found with id: ${orderId}`);
  const currentStatus = mapFhirToOrderStatus(orderResources.medicationAdministration);
  if (currentStatus !== 'pending' && newStatus)
    throw new Error(`Can't change status if current is not 'pending'. Current status is: ${currentStatus}`);
  console.log(`Current order status is: ${currentStatus}`);

  if (newStatus) validateProviderAccess(orderData, newStatus, orderResources, practitionerIdCalledZambda);

  const existingMedicationCopy = getMedicationFromMA(orderResources.medicationAdministration);
  let newMedicationCopy: Medication | undefined;
  if (orderData?.medicationId && orderData?.medicationId !== IN_HOUSE_CONTAINED_MEDICATION_ID) {
    console.log('Creating new copy for order');
    const inventoryMedication = await getMedicationById(oystehr, orderData?.medicationId);
    newMedicationCopy = createMedicationCopy(inventoryMedication, orderData);
  } else if (existingMedicationCopy) {
    console.log('Updating existing copy for order');
    // during copy process we also update lotNumber, expDate etc.
    newMedicationCopy = createMedicationCopy(existingMedicationCopy, orderData, newStatus);
  }

  const transactionRequests: BatchInputRequest<FhirResource>[] = [];
  console.log(
    `Updating MedicationAdministration, orderData present: ${Boolean(orderData)}, newMedicationCopy present: ${Boolean(
      newMedicationCopy
    )}, newStatus: ${newStatus}`
  );
  let updatedMedicationAdministration: MedicationAdministration | undefined = undefined;
  const medicationAdministrationPatchOperations: Operation[] = [];
  if (orderData && newMedicationCopy) {
    updatedMedicationAdministration = updateMedicationAdministrationData({
      orderData,
      orderResources,
      administeredProviderId: newStatus !== undefined ? practitionerIdCalledZambda : undefined,
      orderedByProviderId: orderData.providerId,
      medicationResource: newMedicationCopy,
    });
  }

  if (currentStatus && newStatus) {
    if (updatedMedicationAdministration) {
      updatedMedicationAdministration.status = mapOrderStatusToFhir(newStatus);
    } else {
      medicationAdministrationPatchOperations.push(replaceOperation('/status', mapOrderStatusToFhir(newStatus)));
    }

    if (newStatus === 'administered') {
      if (!newMedicationCopy) throw new Error(`Can't create MedicationStatement for order, no Medication copy.`);

      const erxDataFromMedication = newMedicationCopy.code?.coding?.find(
        (code) => code.system === MEDICATION_DISPENSABLE_DRUG_ID
      );

      if (!erxDataFromMedication)
        throw new Error(
          `Can't create MedicationStatement for order, Medication resource don't have coding with ERX data in it`
        );

      const medicationCodeableConcept: CodeableConcept = {
        coding: [{ ...erxDataFromMedication, display: getMedicationName(newMedicationCopy) }],
      };

      const { effectiveDateTime } = orderData || {};
      transactionRequests.push({
        method: 'POST',
        url: `/MedicationStatement`,
        // effective date time for MedicationAdministration is date of creation,
        // and effective date time for MedicationStatement is date of medication was given/taken
        resource: createMedicationStatementResource(
          orderResources.medicationAdministration,
          medicationCodeableConcept,
          {
            effectiveDateTime,
          }
        ),
      });
    }
  }

  if (interactions && newMedicationCopy) {
    if (orderResources.medicationRequest == null) {
      const medicationRequestFullUrl = 'urn:uuid:' + randomUUID();
      transactionRequests.push({
        method: 'POST',
        url: `/MedicationRequest`,
        fullUrl: medicationRequestFullUrl,
        resource: createMedicationRequest(orderData, interactions, newMedicationCopy),
      });
      if (updatedMedicationAdministration) {
        updatedMedicationAdministration.request = {
          reference: medicationRequestFullUrl,
        };
      } else {
        replaceOperation('/request', {
          reference: medicationRequestFullUrl,
        });
      }
    } else {
      transactionRequests.push({
        method: 'PUT',
        url: `/MedicationRequest/${orderResources.medicationRequest.id}`,
        resource: {
          ...createMedicationRequest(orderData, interactions, newMedicationCopy),
          id: orderResources.medicationRequest.id,
        },
      });
    }
  }

  if (updatedMedicationAdministration) {
    transactionRequests.push({
      method: 'PUT',
      url: `/MedicationAdministration/${updatedMedicationAdministration.id}`,
      resource: updatedMedicationAdministration,
    });
  }
  if (medicationAdministrationPatchOperations.length > 0) {
    transactionRequests.push(
      getPatchBinary({
        resourceType: 'MedicationAdministration',
        resourceId: orderResources.medicationAdministration.id!,
        patchOperations: medicationAdministrationPatchOperations,
      })
    );
  }

  console.log('Transaction requests: ', JSON.stringify(transactionRequests));
  const transactionResult = await oystehr.fhir.transaction({ requests: transactionRequests });

  console.log('Transaction result: ', JSON.stringify(transactionResult));
}

async function createOrder(
  oystehr: Oystehr,
  orderData: MedicationData,
  interactions: MedicationInteractions | undefined,
  practitionerIdCalledZambda: string
): Promise<string | undefined> {
  console.log('createOrder');

  if (!orderData.medicationId) throw new Error('No "medicationId" provided');
  const inventoryMedication = await getMedicationById(oystehr, orderData.medicationId);
  if (inventoryMedication && getMedicationTypeCode(inventoryMedication) !== INVENTORY_MEDICATION_TYPE_CODE) {
    throw new Error(
      `Medication with id ${orderData.medicationId} is not medication inventory item, can't copy that resource`
    );
  }
  const medicationCopy = createMedicationCopy(inventoryMedication, orderData);
  console.log(`Created medication copy: ${getMedicationName(medicationCopy)}`);

  const routeCoding = searchRouteByCode(orderData.route);
  if (!routeCoding) throw new Error(`No medication appliance route was found for code: ${orderData.route}`);
  const locationCoding = orderData.location ? searchMedicationLocation(orderData.location) : undefined;
  if (orderData.location && !locationCoding)
    throw new Error(`No location found with code provided: ${orderData.location}`);

  const medicationRequestToCreate = createMedicationRequest(orderData, interactions, medicationCopy);
  const medicationRequestFullUrl = 'urn:uuid:' + randomUUID();
  const medicationAdministrationToCreate = createMedicationAdministrationResource({
    orderData,
    status: mapOrderStatusToFhir('pending'),
    route: routeCoding,
    location: locationCoding,
    createdProviderId: practitionerIdCalledZambda,
    orderedByProviderId: orderData.providerId, // NEW: add initial provider to history
    dateTimeCreated: DateTime.now().toISO(),
    medicationResource: medicationCopy,
  });
  medicationAdministrationToCreate.request = {
    reference: medicationRequestFullUrl,
  };

  const transactionRequests: BatchInput<FhirResource> = {
    requests: [
      {
        method: 'POST',
        fullUrl: medicationRequestFullUrl,
        url: '/MedicationRequest',
        resource: medicationRequestToCreate,
      },
      {
        method: 'POST',
        url: '/MedicationAdministration',
        resource: medicationAdministrationToCreate,
      },
    ],
  };
  console.log('Transaction input: ', JSON.stringify(transactionRequests));

  const transactionResult = await oystehr.fhir.transaction(transactionRequests);
  console.log('Transaction result: ', JSON.stringify(transactionResult));

  return transactionResult.entry?.find((entry) => entry?.resource?.resourceType === 'MedicationAdministration')
    ?.resource?.id;
}

async function changeOrderStatus(
  oystehr: Oystehr,
  pkg: OrderPackage,
  newStatus: MedicationOrderStatusesType
): Promise<any> {
  console.log(`Changing status to: ${newStatus}`);
  return await oystehr.fhir.patch({
    resourceType: 'MedicationAdministration',
    id: pkg.medicationAdministration.id!,
    operations: [replaceOperation('/status', mapOrderStatusToFhir(newStatus))],
  });
}

async function getOrderResources(oystehr: Oystehr, orderId: string): Promise<OrderPackage | undefined> {
  const bundle = await oystehr.fhir.search({
    resourceType: 'MedicationAdministration',
    params: [
      {
        name: '_id',
        value: orderId,
      },
      {
        name: '_include',
        value: 'MedicationAdministration:subject',
      },
      {
        name: '_revinclude',
        value: 'MedicationStatement:part-of',
      },
      {
        name: '_include',
        value: 'MedicationAdministration:request',
      },
    ],
  });
  const resources = bundle.unbundle();
  const medicationAdministration = resources.find(
    (res) => res.resourceType === 'MedicationAdministration'
  ) as MedicationAdministration;
  if (!medicationAdministration) throw new Error(`No medicationAdministration was found with id ${orderId}`);
  const patient = resources.find((res) => res.resourceType === 'Patient') as Patient;
  if (!patient) throw new Error(`No patient was found for medicationAdministration with id ${orderId}`);
  const medicationStatement = resources.find(
    (res) => res.resourceType === 'MedicationStatement'
  ) as MedicationStatement;

  const medicationRequestId = medicationAdministration.request?.reference?.split('/')[1];
  const medicationRequest = resources.find(
    (resource) => resource.resourceType === 'MedicationRequest' && resource.id === medicationRequestId
  ) as MedicationRequest;

  return {
    medicationAdministration,
    medicationStatement,
    medicationRequest,
    patient,
  };
}
