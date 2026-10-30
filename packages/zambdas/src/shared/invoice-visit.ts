import Oystehr from '@oystehr/sdk';
import { Account, Appointment, Encounter, Location, Patient, Schedule } from 'fhir/r4b';
import Stripe from 'stripe';
import { PATIENT_BILLING_ACCOUNT_TYPE } from 'utils/lib/fhir/constants';
import { getPatientReferenceFromAccount, getStripeCustomerIdFromAccount } from 'utils/lib/fhir/helpers';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { FHIR_RESOURCE_NOT_FOUND, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import { accountMatchesType } from '../ehr/shared/harvest';
import { ensureStripeCustomerId } from './stripeIntegration';

export interface InvoiceVisitResources {
  patient: Patient;
  encounter: Encounter;
  account: Account;
  appointment: Appointment;
  stripeAccountId?: string;
  location?: Location;
  schedule?: Schedule;
}

export async function getInvoiceVisitResources(oystehr: Oystehr, encounterId: string): Promise<InvoiceVisitResources> {
  const response = (
    await oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:patient',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
        {
          name: '_revinclude:iterate',
          value: 'Account:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Schedule:actor:Location',
        },
      ],
    })
  ).unbundle();

  const encounter = response.find((resource) => resource.resourceType === 'Encounter') as Encounter;
  if (!encounter) throw FHIR_RESOURCE_NOT_FOUND('Encounter');

  const patientId = removePrefix('Patient/', encounter.subject?.reference ?? '');
  if (!patientId) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR("Encounter doesn't have patient reference");

  const patient = response.find(
    (resource) => resource.resourceType === 'Patient' && resource.id === patientId
  ) as Patient;
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND('Patient');
  const accounts = response.filter(
    (resource) =>
      resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
  ) as Account[];
  const account = accounts.find((account) => accountMatchesType(account, PATIENT_BILLING_ACCOUNT_TYPE));
  if (!account) throw FHIR_RESOURCE_NOT_FOUND('Account');

  const appointment = response.find((res) => res.resourceType === 'Appointment') as Appointment;
  if (!appointment) throw FHIR_RESOURCE_NOT_FOUND('Appointment');
  const locationId = appointment.participant
    ?.find((p) => p.actor?.reference?.startsWith('Location/'))
    ?.actor?.reference?.split('/')[1];
  let location: Location | undefined;
  if (locationId) {
    location = response.find((res) => res.resourceType === 'Location' && res.id === locationId) as Location;
    if (!location) throw FHIR_RESOURCE_NOT_FOUND('Location');
  } else console.log("Appointment doesn't have location id");
  const schedule = location?.id
    ? (response.filter((res) => res.resourceType === 'Schedule') as Schedule[]).find(
        (s) => s.actor?.some((a) => a.reference === `Location/${location.id}`)
      )
    : undefined;
  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehr);

  console.log('Fhir encounter found: ', encounter.id);
  console.log('Fhir patient found: ', patient.id);
  console.log('Fhir account found', account?.id);
  console.log('Fhir appointment found: ', appointment.id);
  console.log('Fhir location found: ', location?.id);
  if (stripeAccount) console.log('Stripe account id (optional): ', stripeAccount);

  return {
    encounter,
    patient,
    account,
    appointment,
    location,
    schedule,
    stripeAccountId: stripeAccount,
  };
}

// Creates the customer on the patient's Account when it has none for this connected account.
export async function resolveInvoiceStripeCustomerId(params: {
  oystehr: Oystehr;
  stripe: Stripe;
  patient: Patient;
  account: Account;
  stripeAccountId?: string;
}): Promise<string> {
  const { oystehr, stripe, patient, account, stripeAccountId } = params;
  let stripeCustomerId = getStripeCustomerIdFromAccount(account, stripeAccountId);
  if (!stripeCustomerId) {
    console.log('No Stripe customer ID on account, creating one now');
    const { customerId } = await ensureStripeCustomerId(
      {
        guarantorResource: patient,
        account,
        patientId: patient.id!,
        stripeClient: stripe,
        stripeAccount: stripeAccountId,
      },
      oystehr
    );
    stripeCustomerId = customerId;
  }

  const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId, { stripeAccount: stripeAccountId });
  if (stripeCustomer.deleted || !stripeCustomer.email) {
    throw new Error(
      'In order to create invoices that are sent to the customer, the responsible party must have a valid email.'
    );
  }
  return stripeCustomerId;
}
