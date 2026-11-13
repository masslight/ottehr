import type { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';

export const cardPayment: PatientPaymentDTO = {
  paymentMethod: 'card',
  amountInCents: 12500,
  dateISO: '2026-11-10T15:24:00.000-05:00',
  fhirPaymentNotificationId: 'payment-notice-1',
  cardBrand: 'visa',
  cardLast4: '4242',
  stripePaymentMethodId: 'pm_1QExampleCard4242AbCdEfGh',
  stripePaymentId: 'pi_3QExamplePayment0001',
  description: 'Copay',
  takenBy: 'Marcus Chen',
};

export const cashPayment: PatientPaymentDTO = {
  paymentMethod: 'cash',
  amountInCents: 4000,
  dateISO: '2026-11-10T15:24:00.000-05:00',
  fhirPaymentNotificationId: 'payment-notice-2',
  description: 'Copay',
  takenBy: 'Marcus Chen',
};
