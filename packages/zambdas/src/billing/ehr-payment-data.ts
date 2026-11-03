import Oystehr from '@oystehr/sdk';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { GetPatientPaymentVisitsResponse } from 'utils/lib/types/api/patient-payment-visits.types';
import { SCHEDULE_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { ClinicalPaymentLookups } from './patient-payment-dtos';

// Billing's one door to the clinical side of patient payments: the EHR zambda interface, invoked over
// the wire. Billing code never imports EHR modules and never reads clinical FHIR resources directly.

export const getPatientPaymentVisits = async (
  oystehr: Oystehr,
  clinicalPatientId: string
): Promise<GetPatientPaymentVisitsResponse> =>
  chooseJson<GetPatientPaymentVisitsResponse>(
    await oystehr.zambda.execute({ id: 'get-patient-payment-visits', patientId: clinicalPatientId })
  );

// Payment lookups answered from what the EHR returned for the patient's visits. Submitter names are
// stamped on the notices (the EHR names its legacy ones), so there is no Practitioner lookup.
export const ehrClinicalPaymentLookups = ({
  visits,
  stripeCustomers,
}: GetPatientPaymentVisitsResponse): ClinicalPaymentLookups => {
  const visitsByEncounterId = new Map(visits.map((visit) => [visit.encounterId, visit]));
  return {
    scheduleStripeAccount: async (encounterId) => {
      const scheduleOwner = visitsByEncounterId.get(encounterId)?.scheduleOwner;
      if (!scheduleOwner) throw SCHEDULE_NOT_FOUND_ERROR;
      return scheduleOwner.stripeAccount;
    },
    stripeCustomerId: (stripeAccount) =>
      stripeCustomers.find((customer) => customer.stripeAccount === stripeAccount)?.customerId,
  };
};
