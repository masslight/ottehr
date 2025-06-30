import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CodeableConcept, Medication, MedicationAdministration, MedicationStatement, Patient } from 'fhir/r4b';
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
  MedicationOrderStatusesType,
  OrderPackage,
  replaceOperation,
  searchMedicationLocation,
  searchRouteByCode,
  UpdateMedicationOrderInput,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../shared';
import { createMedicationAdministrationResource, createMedicationStatementResource } from './fhir-resources-creation';
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

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
};

async function performEffect(
  oystehr: Oystehr,
  params: UpdateMedicationOrderInput,
  practitionerIdCalledZambda: string
): Promise<any> {
  const { orderId, newStatus, orderData } = params;
  if (orderId && orderData) {
    await updateOrder(oystehr, orderId, newStatus, orderData, practitionerIdCalledZambda);
    return {
      message: 'Order was updated successfully',
      id: orderId,
    };
  } else if (orderData) {
    const medicationAdministrationId = await createOrder(oystehr, orderData, practitionerIdCalledZambda);
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
  practitionerIdCalledZambda: string
): Promise<any> {
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
    newMedicationCopy = createMedicationCopy(existingMedicationCopy, orderData);
  }

  const resultPromises: Promise<any>[] = [];
  console.log(
    `Updating MedicationAdministration, orderData present: ${Boolean(orderData)}, newMedicationCopy present: ${Boolean(
      newMedicationCopy
    )}, newStatus: ${newStatus}`
  );
  if (orderData && newMedicationCopy) {
    await updateMedicationAdministrationData({
      oystehr,
      orderData,
      orderResources,
      administeredProviderId: newStatus !== undefined ? practitionerIdCalledZambda : undefined,
      medicationResource: newMedicationCopy,
    });
    console.log('MedicationAdministration data was successfully updated.');
  }
  if (currentStatus && newStatus) {
    resultPromises.push(changeOrderStatus(oystehr, orderResources, newStatus));
    if (newStatus === 'administered') {
      console.log('Creating MedicationStatement resource on administered action');

      if (!newMedicationCopy) throw new Error(`Can't create MedicationStatement for order, no Medication copy.`);

      const erxDataFromMedication = newMedicationCopy.code?.coding?.find(
        (code) => code.system === MEDICATION_DISPENSABLE_DRUG_ID
      );
      if (!erxDataFromMedication)
        throw new Error(
          `Can't create MedicationStatement for order, Medication resource don't have coding with ERX data in it`
        );
      const medicationCodeableConcept: CodeableConcept = {
        coding: [erxDataFromMedication],
      };
      resultPromises.push(
        oystehr.fhir
          .create<MedicationStatement>(
            createMedicationStatementResource(orderResources.medicationAdministration, medicationCodeableConcept)
          )
          .then((res) => console.log('successfully created MedicationStatement: ', res.id))
      );
    }
    console.log('Status was successfully changed');
  }
  await Promise.all(resultPromises);
}

async function createOrder(
  oystehr: Oystehr,
  orderData: MedicationData,
  practitionerIdCalledZambda: string
): Promise<string | undefined> {
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

  const medicationAdministrationToCreate = createMedicationAdministrationResource({
    orderData,
    status: mapOrderStatusToFhir('pending'),
    route: routeCoding,
    location: locationCoding,
    createdProviderId: practitionerIdCalledZambda,
    dateTimeCreated: DateTime.now().toISO(),
    medicationResource: medicationCopy,
  });
  console.log('MedicationAdministration resource: ', JSON.stringify(medicationAdministrationToCreate));
  const resultMedicationAdministration = await oystehr.fhir.create(medicationAdministrationToCreate);
  return resultMedicationAdministration.id;
}

async function changeOrderStatus(
  oystehr: Oystehr,
  pkg: OrderPackage,
  newStatus: MedicationOrderStatusesType
): Promise<Bundle<MedicationAdministration>> {
  const batchInputRequests: BatchInputRequest<MedicationAdministration>[] = [];
  console.log(`Changing status to: ${newStatus}`);
  batchInputRequests.push(
    getPatchBinary({
      resourceType: 'MedicationAdministration',
      resourceId: pkg.medicationAdministration.id!,
      patchOperations: [replaceOperation('/status', mapOrderStatusToFhir(newStatus))],
    })
  );
  return await oystehr.fhir.transaction({ requests: batchInputRequests });
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

  return {
    medicationAdministration,
    medicationStatement,
    patient,
  };
}
