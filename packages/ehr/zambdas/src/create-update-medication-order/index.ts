import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication, MedicationAdministration, MedicationStatement, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getMedicationName,
  getMedicationTypeCode,
  getPatchBinary,
  getPractitionerIdThatOrderedMedication,
  INVENTORY_MEDICATION_TYPE_CODE,
  mapFhirToOrderStatus,
  mapOrderStatusToFhir,
  MedicationData,
  MedicationOrderStatusesType,
  OrderPackage,
  replaceOperation,
  searchMedicationLocation,
  searchRouteByCode,
  UpdateMedicationOrderInput,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { createMedicationAdministrationResource, createMedicationStatementResource } from './fhir-recources-creation';
import {
  createMedicationCopy,
  createOrRecreateMedicationForOrder,
  getMedicationById,
  practitionerIdFromZambdaInput,
  updateMedicationAdministrationData,
  updateMedicationCopyForOrder,
  validateProviderAccess,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface ExtendedMedicationData extends MedicationData {
  administeredProvider?: string;
  providerCreatedTheOrder: string;
  medicationCopyId?: string;
  medicationCopyName?: string;
  orderDateTimeCreated?: string;
}

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mtoken, validatedParameters.secrets);
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
  const extendedOrderData = { ...orderData } as ExtendedMedicationData;
  if (orderId) {
    await updateOrder(oystehr, orderId, newStatus, extendedOrderData, practitionerIdCalledZambda);
    return {
      message: 'Order was updated successfully',
      id: orderId,
    };
  } else if (orderData) {
    const medicationAdministrationId = await createOrder(oystehr, extendedOrderData, practitionerIdCalledZambda);
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
  extendedOrderData: ExtendedMedicationData,
  practitionerIdCalledZambda: string
): Promise<any> {
  const orderPkg = await getOrderResources(oystehr, orderId);
  if (!orderPkg) throw new Error(`No order found with id: ${orderId}`);
  const currentStatus = mapFhirToOrderStatus(orderPkg.medicationAdministration);
  if (currentStatus !== 'pending' && newStatus)
    throw new Error(`Can't change status if current is not 'pending'. Current status is: ${currentStatus}`);
  console.log(`Current order status is: ${currentStatus}`);

  if (newStatus) validateProviderAccess(extendedOrderData, newStatus, orderPkg, practitionerIdCalledZambda);

  // filling up existing information about provider created this order
  extendedOrderData.providerCreatedTheOrder = getPractitionerIdThatOrderedMedication(
    orderPkg.medicationAdministration
  )!;
  if (extendedOrderData?.medicationId) {
    const foundMedication = await getMedicationById(oystehr, extendedOrderData?.medicationId);
    const medicationCopy = await createOrRecreateMedicationForOrder(
      oystehr,
      orderPkg,
      foundMedication,
      extendedOrderData
    );
    extendedOrderData.medicationCopyId = medicationCopy?.id;
    extendedOrderData.medicationCopyName = medicationCopy && getMedicationName(medicationCopy);
  } else if (orderPkg.medication) {
    const medicationCopy = await updateMedicationCopyForOrder(
      oystehr,
      orderPkg.medication,
      orderPkg.medication.id!,
      extendedOrderData
    );
    extendedOrderData.medicationCopyId = medicationCopy.id;
    extendedOrderData.medicationCopyName = getMedicationName(medicationCopy);
  }

  const resultPromises: Promise<any>[] = [];
  if (extendedOrderData) {
    if (newStatus === 'administered') extendedOrderData.administeredProvider = practitionerIdCalledZambda;
    await updateMedicationAdministrationData(oystehr, extendedOrderData, orderPkg);
    console.log('MedicationAdministration data was successfully updated.');
  }
  if (currentStatus && newStatus) {
    resultPromises.push(changeOrderStatus(oystehr, orderPkg, newStatus));
    if (newStatus === 'administered') {
      console.log('Creating MedicationStatement resource on administrated action');
      if (!extendedOrderData.medicationCopyId || !extendedOrderData.medicationCopyName)
        throw new Error(`No medication name or id found for order. Can't create MedicationStatement for order.`);
      resultPromises.push(
        oystehr.fhir.create<MedicationStatement>(
          createMedicationStatementResource(
            orderPkg.medicationAdministration,
            extendedOrderData.medicationCopyId,
            extendedOrderData.medicationCopyName
          )
        )
      );
    }
    console.log('Status was successfully changed');
  }
  await Promise.all(resultPromises);
}

async function createOrder(
  oystehr: Oystehr,
  extendedOrderData: ExtendedMedicationData,
  practitionerIdCalledZambda: string
): Promise<string | undefined> {
  const inventoryMedication = await getMedicationById(oystehr, extendedOrderData.medicationId);
  if (inventoryMedication && getMedicationTypeCode(inventoryMedication) !== INVENTORY_MEDICATION_TYPE_CODE) {
    throw new Error(
      `Medication with id ${extendedOrderData.medicationId} is not medication inventory item, can't copy that resource`
    );
  }
  const medicationCopy = createMedicationCopy(inventoryMedication, extendedOrderData);
  const createdMedicationCopyResource = await oystehr.fhir.create(medicationCopy);
  extendedOrderData.medicationCopyId = createdMedicationCopyResource.id;
  console.log(`Created copy: ${createdMedicationCopyResource.id}`);

  extendedOrderData.providerCreatedTheOrder = practitionerIdCalledZambda;
  extendedOrderData.orderDateTimeCreated = DateTime.now().toISO() ?? undefined;
  const routeCoding = searchRouteByCode(extendedOrderData.route);
  if (!routeCoding) throw new Error(`No medication appliance route was found for code: ${extendedOrderData.route}`);
  const locationCoding = extendedOrderData.location ? searchMedicationLocation(extendedOrderData.location) : undefined;
  if (extendedOrderData.location && !locationCoding)
    throw new Error(`No location found with code provided: ${extendedOrderData.location}`);

  const medicationAdministrationToCreate = createMedicationAdministrationResource(
    extendedOrderData,
    mapOrderStatusToFhir('pending'),
    routeCoding,
    locationCoding
  );
  console.log('MedicationAdministration we creating: ', JSON.stringify(medicationAdministrationToCreate));
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
        value: 'MedicationAdministration:medication',
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
  const medication = resources.find((res) => res.resourceType === 'Medication') as Medication;

  return {
    medicationAdministration,
    medicationStatement,
    medication,
    patient,
  };
}
