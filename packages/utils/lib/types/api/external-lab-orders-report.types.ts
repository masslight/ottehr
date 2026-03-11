export type OrderCategory = 'lab' | 'radiology' | 'procedure';

export interface LabsRadsProdsReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  locationId?: string; // Optional filter by location
}

export interface OrderReportItem {
  serviceRequestId: string;
  orderCategory: OrderCategory;
  orderName: string; // Test name for labs, study type for rads, procedure type for procs
  orderCode?: string; // CPT or LOINC code
  orderDate: string; // ISO date string
  patientId: string;
  patientName: string;
  encounterId: string;
  encounterDate: string; // Appointment start ISO date string
  orderingProvider: string;
  location: string;
  locationId?: string;
  status: string;
  diagnoses: string[];
  // Lab-specific
  labOrganization?: string;
  isPSC?: boolean;
  // Radiology-specific
  isStat?: boolean;
}

export interface OrderSummaryItem {
  orderName: string;
  orderCode?: string;
  orderCategory: OrderCategory;
  count: number;
}

export interface LabsRadsProdsReportZambdaOutput {
  message: string;
  totalOrders: number;
  summary: OrderSummaryItem[];
  orders: OrderReportItem[];
  dateRange: {
    start: string;
    end: string;
  };
  locationId?: string;
}
