export enum NursingOrdersStatus {
  pending = 'pending',
  completed = 'completed',
  cancelled = 'cancelled',
  unknown = 'unknown',
}

const PROVENANCE_ACTIVITY_TYPE_SYSTEM = 'https://identifiers.fhir.oystehr.com/provenance-activity-type';

const PROVENANCE_ACTIVITY_CODES = {
  createOrder: 'CREATE ORDER',
  completeOrder: 'COMPLETE ORDER',
  cancelOrder: 'CANCEL ORDER',
} as const;

const PROVENANCE_ACTIVITY_DISPLAY = {
  createOrder: 'create order',
  completeOrder: 'complete order',
  cancelOrder: 'cancel order',
} as const;

export const NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY = {
  createOrder: {
    code: PROVENANCE_ACTIVITY_CODES.createOrder,
    display: PROVENANCE_ACTIVITY_CODES.createOrder,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
  completeOrder: {
    code: PROVENANCE_ACTIVITY_CODES.completeOrder,
    display: PROVENANCE_ACTIVITY_DISPLAY.completeOrder,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
  cancelOrder: {
    code: PROVENANCE_ACTIVITY_CODES.cancelOrder,
    display: PROVENANCE_ACTIVITY_DISPLAY.cancelOrder,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
} as const;
