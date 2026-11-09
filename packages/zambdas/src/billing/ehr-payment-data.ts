import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { GetPatientPaymentVisitsResponse } from 'utils/lib/types/api/patient-payment-visits.types';
import { SCHEDULE_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { ClinicalPaymentLookups } from './patient-payment-dtos';
import { ScopedOystehr } from './shared';

// Billing's one door to the clinical side of patient payments: the EHR zambda interface, invoked over
// the wire. Billing code never imports EHR modules and never reads clinical FHIR resources directly.

export const getPatientPaymentVisits = async (
  oystehr: ScopedOystehr,
  clinicalPatientId: string,
  // narrows the response to this one of the patient's visits
  encounterId?: string
): Promise<GetPatientPaymentVisitsResponse> =>
  chooseJson<GetPatientPaymentVisitsResponse>(
    await oystehr.zambda.execute({
      id: 'get-patient-payment-visits',
      patientId: clinicalPatientId,
      ...(encounterId ? { encounterId } : {}),
    })
  );

// Payment lookups answered from what the EHR returned for the patient's visits. There is no
// Practitioner lookup: the EHR names the submitters on the notices it returns, so takenBy comes
// from the name stamped on each notice.
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
