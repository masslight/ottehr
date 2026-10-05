// Mock data for the UI-only Payments tab prototype — see docs/billing-patient-payments-tab.md.
export type MockPaymentMethod = 'card' | 'card-reader' | 'external-card-reader' | 'cash' | 'check' | 'invoice';

export interface MockPayment {
  id: string;
  paymentDate: string;
  amountInCents: number;
  encounter?: { date: string; appointmentId: string };
  claim?: { date: string; claimId: string };
  method: MockPaymentMethod;
  cardBrand?: string;
  cardLast4?: string;
  invoiceId?: string;
  refundedAmountInCents: number;
}

export type MockInvoiceStatus = 'open' | 'past-due' | 'paid' | 'void';

export interface MockInvoice {
  id: string;
  invoiceDate: string;
  dueDate: string;
  amountInCents: number;
  visit?: { date: string; appointmentId: string };
  claim?: { date: string; claimId: string };
  status: MockInvoiceStatus;
  paymentId?: string;
}

export const MOCK_PAYMENTS: MockPayment[] = [
  {
    id: 'pay-1',
    paymentDate: '2026-09-28',
    amountInCents: 7500,
    encounter: { date: '2026-09-28', appointmentId: 'mock-appt-1' },
    claim: { date: '2026-09-28', claimId: 'mock-claim-1' },
    method: 'card-reader',
    cardBrand: 'visa',
    cardLast4: '4242',
    refundedAmountInCents: 0,
  },
  {
    id: 'pay-2',
    paymentDate: '2026-09-12',
    amountInCents: 12050,
    encounter: { date: '2026-08-30', appointmentId: 'mock-appt-2' },
    claim: { date: '2026-08-30', claimId: 'mock-claim-2' },
    method: 'invoice',
    invoiceId: 'inv-2',
    refundedAmountInCents: 0,
  },
  {
    id: 'pay-3',
    paymentDate: '2026-08-30',
    amountInCents: 2500,
    encounter: { date: '2026-08-30', appointmentId: 'mock-appt-2' },
    method: 'cash',
    refundedAmountInCents: 0,
  },
  {
    id: 'pay-4',
    paymentDate: '2026-07-15',
    amountInCents: 15000,
    encounter: { date: '2026-07-15', appointmentId: 'mock-appt-3' },
    claim: { date: '2026-07-15', claimId: 'mock-claim-3' },
    method: 'card',
    cardBrand: 'mastercard',
    cardLast4: '5100',
    refundedAmountInCents: 5000,
  },
  {
    id: 'pay-5',
    paymentDate: '2026-06-02',
    amountInCents: 4000,
    encounter: { date: '2026-06-02', appointmentId: 'mock-appt-4' },
    method: 'external-card-reader',
    refundedAmountInCents: 0,
  },
  {
    id: 'pay-6',
    paymentDate: '2026-05-20',
    amountInCents: 8900,
    encounter: { date: '2026-05-01', appointmentId: 'mock-appt-5' },
    claim: { date: '2026-05-01', claimId: 'mock-claim-5' },
    method: 'invoice',
    invoiceId: 'inv-4',
    refundedAmountInCents: 8900,
  },
  {
    id: 'pay-7',
    paymentDate: '2026-05-01',
    amountInCents: 3000,
    encounter: { date: '2026-05-01', appointmentId: 'mock-appt-5' },
    method: 'check',
    refundedAmountInCents: 3000,
  },
];

export const MOCK_INVOICES: MockInvoice[] = [
  {
    id: 'inv-1',
    invoiceDate: '2026-09-30',
    dueDate: '2026-10-30',
    amountInCents: 6200,
    visit: { date: '2026-09-28', appointmentId: 'mock-appt-1' },
    claim: { date: '2026-09-28', claimId: 'mock-claim-1' },
    status: 'open',
  },
  {
    id: 'inv-2',
    invoiceDate: '2026-09-02',
    dueDate: '2026-10-02',
    amountInCents: 12050,
    visit: { date: '2026-08-30', appointmentId: 'mock-appt-2' },
    claim: { date: '2026-08-30', claimId: 'mock-claim-2' },
    status: 'paid',
    paymentId: 'pay-2',
  },
  {
    id: 'inv-3',
    invoiceDate: '2026-07-20',
    dueDate: '2026-08-19',
    amountInCents: 5400,
    visit: { date: '2026-07-15', appointmentId: 'mock-appt-3' },
    claim: { date: '2026-07-15', claimId: 'mock-claim-3' },
    status: 'past-due',
  },
  {
    id: 'inv-4',
    invoiceDate: '2026-05-05',
    dueDate: '2026-06-04',
    amountInCents: 8900,
    visit: { date: '2026-05-01', appointmentId: 'mock-appt-5' },
    claim: { date: '2026-05-01', claimId: 'mock-claim-5' },
    status: 'paid',
    paymentId: 'pay-6',
  },
  {
    id: 'inv-5',
    invoiceDate: '2026-04-10',
    dueDate: '2026-05-10',
    amountInCents: 2100,
    visit: { date: '2026-04-08', appointmentId: 'mock-appt-6' },
    status: 'void',
  },
];

export const openInvoicesTotalInCents = (invoices: MockInvoice[]): number =>
  invoices
    .filter((inv) => inv.status === 'open' || inv.status === 'past-due')
    .reduce((sum, inv) => sum + inv.amountInCents, 0);

export const pastDueInvoicesTotalInCents = (invoices: MockInvoice[]): number =>
  invoices.filter((inv) => inv.status === 'past-due').reduce((sum, inv) => sum + inv.amountInCents, 0);
