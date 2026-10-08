import { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY } from 'utils/lib/types/data/orders/constants';
import { UpdateNursingOrderInputValidated } from 'utils/lib/types/data/orders/types';
import { fillMeta } from './helpers';

export interface NursingOrderResourcesInput {
  encounterId: string;
  patientId: string;
  /** Used only for the Task description, which reads "Create nursing order for <name>". */
  patientName: string;
  /** Becomes ServiceRequest.requester — the provider the order is placed under. */
  attendingPractitionerId: string;
  /** Becomes the create-order Provenance agent — whoever actually caused the order to exist. */
  createdByPractitionerId: string;
  notes?: string;
  locationId?: string;
  coverageId?: string;
  /**
   * Resources that caused this order to be raised, e.g. `MedicationAdministration/<id>` for an
   * auto-generated vitals re-check. Doubles as the idempotency marker, since ServiceRequest has no
   * search parameter for supportingInfo and callers have to filter on it client-side.
   */
  supportingInfoReferences?: string[];
}

/**
 * Builds the three resources a nursing order is made of. A nursing order is not a single resource:
 * the ServiceRequest holds the note text, the Task carries the status that get-nursing-orders reads
 * back (`requested` -> pending), and the Provenance supplies the create-order history row and the
 * ordering-physician name. All three must land together or the order reads back as `unknown` status.
 *
 * Kept shared so the automatic vitals re-check order raised by create-update-medication-order stays
 * byte-identical in shape to one a user creates through create-nursing-order.
 */
export const makeNursingOrderTransactionRequests = ({
  encounterId,
  patientId,
  patientName,
  attendingPractitionerId,
  createdByPractitionerId,
  notes,
  locationId,
  coverageId,
  supportingInfoReferences,
}: NursingOrderResourcesInput): BatchInputPostRequest<FhirResource>[] => {
  const serviceRequestFullUrl = `urn:uuid:${randomUUID()}`;
  const now = DateTime.now().toISO();

  const serviceRequest: ServiceRequest = {
    resourceType: 'ServiceRequest',
    status: 'draft',
    intent: 'order',
    subject: {
      reference: `Patient/${patientId}`,
    },
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    requester: {
      reference: `Practitioner/${attendingPractitionerId}`,
    },
    authoredOn: now,
    priority: 'stat',
    ...(locationId && {
      locationReference: [
        {
          type: 'Location',
          reference: `Location/${locationId}`,
        },
      ],
    }),
    meta: fillMeta('nursing order', 'order-type-tag'),
    ...(notes && { note: [{ text: notes }] }),
    ...(coverageId && { insurance: [{ reference: `Coverage/${coverageId}` }] }),
    ...(supportingInfoReferences?.length && {
      supportingInfo: supportingInfoReferences.map((reference) => ({ reference })),
    }),
  };

  const task: Task = {
    resourceType: 'Task',
    status: 'requested',
    description: `Create nursing order for ${patientName}`,
    basedOn: [{ reference: serviceRequestFullUrl }],
    encounter: { reference: `Encounter/${encounterId}` },
    authoredOn: now,
    intent: 'order',
    ...(locationId && { location: { reference: `Location/${locationId}` } }),
  };

  const provenance: Provenance = {
    resourceType: 'Provenance',
    activity: {
      coding: [NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
    },
    target: [{ reference: serviceRequestFullUrl }],
    ...(locationId && { location: { reference: `Location/${locationId}` } }),
    recorded: now,
    agent: [
      {
        who: { reference: `Practitioner/${createdByPractitionerId}` },
        onBehalfOf: { reference: `Practitioner/${attendingPractitionerId}` },
      },
    ],
  };

  return [
    {
      method: 'POST',
      url: '/ServiceRequest',
      resource: serviceRequest,
      fullUrl: serviceRequestFullUrl,
    },
    {
      method: 'POST',
      url: '/Task',
      resource: task,
    },
    {
      method: 'POST',
      url: '/Provenance',
      resource: provenance,
    },
  ];
};

type NursingOrderAction = UpdateNursingOrderInputValidated['action'];

const getTaskStatusForAction = (action: NursingOrderAction): string => {
  switch (action) {
    case 'COMPLETE ORDER':
      return 'completed';
    case 'CANCEL ORDER':
      return 'cancelled';
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

const getRequestStatusForAction = (action: NursingOrderAction): string => {
  switch (action) {
    case 'COMPLETE ORDER':
      return 'completed';
    case 'CANCEL ORDER':
      return 'revoked';
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

const getProvenanceActivity = (action: NursingOrderAction): { code: string; display: string; system: string } => {
  switch (action) {
    case 'COMPLETE ORDER':
      return NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.completeOrder;
    case 'CANCEL ORDER':
      return NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.cancelOrder;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

export const makeNursingOrderStatusChangeRequests = ({
  serviceRequest,
  task,
  action,
  practitionerId,
}: {
  serviceRequest: ServiceRequest;
  task: Task;
  action: NursingOrderAction;
  practitionerId: string;
}): BatchInputRequest<FhirResource>[] => {
  const locationRef: string | undefined = serviceRequest.locationReference?.[0].reference;
  const provenance: Provenance = {
    resourceType: 'Provenance',
    activity: {
      coding: [getProvenanceActivity(action)],
    },
    target: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
    ...(locationRef && { location: { reference: locationRef } }),
    recorded: DateTime.now().toISO(),
    agent: [
      {
        who: { reference: `Practitioner/${practitionerId}` },
        onBehalfOf: { reference: serviceRequest.requester?.reference },
      },
    ],
  };
  return [
    getPatchBinary({
      resourceType: 'Task',
      resourceId: task.id!,
      patchOperations: [
        {
          op: 'replace',
          path: '/status',
          value: getTaskStatusForAction(action),
        },
      ],
    }),
    getPatchBinary({
      resourceType: 'ServiceRequest',
      resourceId: serviceRequest.id!,
      patchOperations: [
        {
          op: 'replace',
          path: '/status',
          value: getRequestStatusForAction(action),
        },
      ],
    }),
    {
      method: 'POST',
      url: '/Provenance',
      resource: provenance,
    },
  ];
};
