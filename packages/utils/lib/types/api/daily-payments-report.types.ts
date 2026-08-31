export interface DailyPaymentsReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  locationId?: string; // Optional filter by location ID
}

export interface PaymentItem {
  id: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  createdDate: string;
  patientName?: string;
  appointmentId?: string;
}

export interface PaymentMethodSummary {
  paymentMethod: string;
  totalAmount: number;
  currency: string;
  transactionCount: number;
  payments: PaymentItem[];
}

export interface DailyPaymentsReportZambdaOutput {
  message: string;
  totalAmount: number;
  totalTransactions: number;
  currencies: string[];
  paymentMethods: PaymentMethodSummary[];
}
