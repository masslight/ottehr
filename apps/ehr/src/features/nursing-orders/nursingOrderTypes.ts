export enum NursingOrdersStatus {
  pending = 'pending',
  completed = 'completed',
  cancelled = 'cancelled',
}

export interface NursingOrder {
  id: string;
  note: string;
  status: NursingOrdersStatus;
  orderDetails?: {
    orderedBy: string;
    orderedDate: string;
  };
}
