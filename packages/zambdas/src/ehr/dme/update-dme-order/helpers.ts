import { BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { DeviceRequest, FhirResource, Procedure, Reference, Task } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { DME_DISPENSED_EXTENSION_URL, DME_TASK, ParsedDmeOrderFields } from 'utils/lib/types/api/dme.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import {
  isDmeOrderExternal,
  makeDmeBillingProcedures,
  makeDmeDeviceRequest,
  makeDmeDispensedExtension,
} from '../../../shared/dme';
import {
  dispenseTaskTitle,
  getDeviceRequestEncounterId,
  getDeviceRequestPatientId,
  isOpenDmeDispenseTask,
  makeBillingProcedureRequests,
  setTaskInputValue,
} from '../shared/order-helpers';

type Request = BatchInputRequest<FhirResource>;

export interface DmeOrderResources {
  deviceRequest: DeviceRequest;
  procedures: Procedure[];
  tasks: Task[];
}

const putDeviceRequest = (existing: DeviceRequest, resource: DeviceRequest): Request => ({
  method: 'PUT',
  url: `/DeviceRequest/${existing.id}`,
  resource,
  ifMatch: makeOptimisticLockIfMatchHeader(existing),
});

const deleteProcedures = (procedures: Procedure[]): Request[] =>
  procedures.map((p) => ({ method: 'DELETE', url: `/Procedure/${p.id}` }));

const setTaskStatus = (task: Task, status: Task['status'], owner?: Reference): Request => {
  const patchOperations: Operation[] = [{ op: 'replace', path: '/status', value: status }];
  if (owner && !task.owner) patchOperations.push({ op: 'add', path: '/owner', value: owner });
  return getPatchBinary({ resourceType: 'Task', resourceId: task.id!, patchOperations });
};

export const refreshDispenseTask = (task: Task, itemName: string, providerName: string | undefined): Task =>
  setTaskInputValue(
    setTaskInputValue({ ...task, description: dispenseTaskTitle(itemName) }, DME_TASK.input.itemName, itemName),
    DME_TASK.input.providerName,
    providerName
  );

export const makeEditRequests = (input: {
  resources: DmeOrderResources;
  fields: ParsedDmeOrderFields;
  providerName: string | undefined;
  newDispenseTask?: Task;
}): Request[] => {
  const { resources, fields, providerName, newDispenseTask } = input;
  const { deviceRequest, procedures, tasks } = resources;
  const dispensed = deviceRequest.status === 'completed';
  if (dispensed && fields.external) {
    throw INVALID_INPUT_ERROR('A dispensed DME order cannot be changed to third-party fulfillment');
  }

  const encounterId = getDeviceRequestEncounterId(deviceRequest);
  const patientId = getDeviceRequestPatientId(deviceRequest);
  const billingRequests = makeBillingProcedureRequests(
    makeDmeBillingProcedures({
      fields,
      encounterId,
      patientId,
      deviceRequestReference: `DeviceRequest/${deviceRequest.id}`,
    })
  );
  const updated = makeDmeDeviceRequest({
    fields,
    encounterId,
    patientId,
    existing: deviceRequest,
    billingProcedureReferences: billingRequests.map((request) => request.fullUrl),
  });

  const requests: Request[] = [
    putDeviceRequest(deviceRequest, updated),
    ...deleteProcedures(procedures),
    ...billingRequests,
  ];

  const openTasks = tasks.filter(isOpenDmeDispenseTask);
  if (fields.external) {
    requests.push(...openTasks.map((task) => setTaskStatus(task, 'cancelled')));
  } else if (!dispensed) {
    if (openTasks.length) {
      requests.push(
        ...openTasks.map(
          (task): Request => ({
            method: 'PUT',
            url: `/Task/${task.id}`,
            resource: refreshDispenseTask(task, fields.itemName, providerName),
            ifMatch: makeOptimisticLockIfMatchHeader(task),
          })
        )
      );
    } else if (newDispenseTask) {
      requests.push({ method: 'POST', url: '/Task', resource: newDispenseTask });
    }
  }
  return requests;
};

export const needsNewDispenseTask = (resources: DmeOrderResources, fields: ParsedDmeOrderFields): boolean =>
  !fields.external && resources.deviceRequest.status !== 'completed' && !resources.tasks.some(isOpenDmeDispenseTask);

export const makeDispenseRequests = (input: {
  resources: DmeOrderResources;
  practitionerId: string | undefined;
  owner: Reference | undefined;
  at: string;
}): Request[] => {
  const { resources, practitionerId, owner, at } = input;
  const { deviceRequest, tasks } = resources;
  if (isDmeOrderExternal(deviceRequest)) {
    throw INVALID_INPUT_ERROR('Third-party DME orders are not dispensed in-house');
  }
  if (deviceRequest.status !== 'active') {
    throw INVALID_INPUT_ERROR('Only pending DME orders can be dispensed');
  }

  const updated: DeviceRequest = {
    ...deviceRequest,
    status: 'completed',
    extension: [
      ...(deviceRequest.extension ?? []).filter((e) => e.url !== DME_DISPENSED_EXTENSION_URL),
      makeDmeDispensedExtension(practitionerId, at),
    ],
  };

  return [
    putDeviceRequest(deviceRequest, updated),
    ...tasks.filter(isOpenDmeDispenseTask).map((task) => setTaskStatus(task, 'completed', owner)),
  ];
};

export const makeDeleteRequests = (resources: DmeOrderResources): Request[] => {
  const { deviceRequest, procedures, tasks } = resources;
  return [
    putDeviceRequest(deviceRequest, { ...deviceRequest, status: 'revoked' }),
    ...deleteProcedures(procedures),
    ...tasks.filter(isOpenDmeDispenseTask).map((task) => setTaskStatus(task, 'cancelled')),
  ];
};
