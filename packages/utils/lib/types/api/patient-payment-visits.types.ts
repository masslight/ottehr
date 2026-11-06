import { PaymentNotice } from 'fhir/r4b';
import { z } from 'zod';

// The clinical side of a patient's payments, served by the EHR to billing so billing never reads
// clinical FHIR resources itself.

export const GetPatientPaymentVisitsInputSchema = z.object({
  patientId: z.string().min(1),
});

export type GetPatientPaymentVisitsInput = z.infer<typeof GetPatientPaymentVisitsInputSchema>;

export interface PatientPaymentVisit {
  encounterId: string;
  appointmentId?: string;
  visitDateISO?: string;
  // the visit's schedule owner, where the EHR takes payments; absent when the visit has none
  scheduleOwner?: {
    // undefined: the platform account
    stripeAccount?: string;
  };
  // payments the EHR recorded on the visit before patient payments moved to billing, their
  // submitters named
  legacyPaymentNotices: PaymentNotice[];
}

export interface PatientStripeCustomer {
  // undefined: the platform account
  stripeAccount?: string;
  customerId: string;
}

export interface GetPatientPaymentVisitsResponse {
  visits: PatientPaymentVisit[];
  stripeCustomers: PatientStripeCustomer[];
}
