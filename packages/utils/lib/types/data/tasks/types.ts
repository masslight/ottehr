export interface CreateManualTaskRequest {
  category: string;
  appointmentId?: string;
  orderId?: string;
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
    other: 'manual-other',
  },
  input: {
    title: 'title',
    details: 'details',
    providerName: 'provider-name',
    appointmentId: 'appointment-id',
    orderId: 'order-id',
    patient: 'patient',
  },
} as const;
