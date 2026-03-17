export interface Task {
  id: string;
  category: string;
  createdDate: string;
  title: string;
  subtitle: string;
  details?: string;
  status: string;
  action?: {
    name: string;
    link: string;
  };
  assignee?: {
    id: string;
    name: string;
    date: string;
  };
  alert?: TaskAlertCode;
  completable: boolean;
}
export interface CreateManualTaskRequest {
  category: string;
  appointmentId?: string;
  orderId?: string;
  encounterId?: string;
  taskTitle: string;
  taskDetails?: string;
  assignee?: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  };
  patient?: {
    id: string;
    name: string;
  };
}

export const MANUAL_TASK = {
  category: {
    externalLab: 'manual-external-lab',
    inHouseLab: 'manual-in-house-lab',
    inHouseMedications: 'manual-in-house-medications',
    nursingOrders: 'manual-nursing-orders',
    patientFollowUp: 'manual-patient-follow-up',
    procedures: 'manual-procedures',
    radiology: 'manual-radiology',
    erx: 'manual-erx',
    charting: 'manual-charting',
    coding: 'manual-coding',
    billing: 'manual-billing',
    other: 'manual-other',
  },
  input: {
    title: 'title',
    details: 'details',
    providerName: 'provider-name',
    appointmentId: 'appointment-id',
    orderId: 'order-id',
    encounterId: 'encounter-id',
    patient: 'patient',
  },
} as const;

export enum TaskAlertCode {
  abnormalLabResult = 'abnormal-lab-result',
}
export const TaskAlertDisplay = {
  [TaskAlertCode.abnormalLabResult]: 'This result contains an abnormal result',
};

export const RADIOLOGY_TASK = {
  category: 'radiology',
  system: 'radiology-task',
  code: {
    reviewFinalResultTask: 'review-final',
  },
  input: {
    patientName: 'patient-name',
    orderDate: 'order-date',
    appointmentId: 'appointment-id',
    providerName: 'provider-name',
    studyTypeDisplay: 'study-type-display',
    studyTypeCode: 'study-type-code',
  },
} as const;
