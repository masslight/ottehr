import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Claim, Patient, RelatedPerson } from 'fhir/r4b';
import { getRelatedPersonsForPatient } from 'utils/lib/auth/user-auth.helper';
import { getActiveAccountGuarantorReference, getResponsiblePartyFromAccount } from 'utils/lib/fhir/helpers';
import {
  getEmailForIndividual,
  getFullName,
  getPhoneNumberForIndividual,
  mapGenderToLabel,
} from 'utils/lib/fhir/patient';
import { GetBillingInvoiceRecipientInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { GetBillingInvoiceRecipientResponse } from 'utils/lib/types/data/billing/billing.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { formatDateConfigurable } from 'utils/lib/utils/dateUtils';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
// eslint-disable-next-line no-restricted-imports -- the invoice goes to the clinical patient and responsible party
import { createClinicalOystehrClient, resolveTimezone } from '../../shared/helpers';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { getInvoiceVisitResources } from '../../shared/invoice-visit';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getInvoiceableEncounterId } from '../invoices';
import { createBillingClient, fetchById } from '../shared';

const ZAMBDA_NAME = 'get-billing-invoice-recipient';

let m2mToken: string;

// Read only. The Send Invoice dialog shows who the invoice and SMS will go to.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { claimId, secrets } = validateWithSchema(GetBillingInvoiceRecipientInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await performEffect(oystehr, clinicalOystehr, claimId);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  clinicalOystehr: Oystehr,
  claimId: string
): Promise<GetBillingInvoiceRecipientResponse> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', claimId);
  const encounterId = getInvoiceableEncounterId(claim);

  const { patient, account, appointment, location, schedule } = await getInvoiceVisitResources(
    clinicalOystehr,
    encounterId
  );
  const responsibleParty = await getResponsibleParty(clinicalOystehr, account, patient);
  // The SMS goes to the patient's portal users, so show their number like the EHR dialog does.
  const [portalUser] = await getRelatedPersonsForPatient(patient.id!, clinicalOystehr);

  return {
    patient: {
      fullName: getFullName(patient),
      dob: formatDateConfigurable({ isoDate: patient.birthDate }),
      gender: patient.gender && mapGenderToLabel[patient.gender],
      phoneNumber: portalUser && getPhoneNumberForIndividual(portalUser),
    },
    responsibleParty: {
      fullName: responsibleParty && getFullName(responsibleParty),
      email: responsibleParty && getEmailForIndividual(responsibleParty),
      phoneNumber: responsibleParty && getPhoneNumberForIndividual(responsibleParty),
    },
    location: location?.name,
    visitDate: formatDateToMDYWithTime(appointment.start, resolveTimezone(schedule, location))?.date,
  };
}

// The guarantor is contained in the Account, the patient, or a RelatedPerson stored on its own.
async function getResponsibleParty(
  oystehr: Oystehr,
  account: Account,
  patient: Patient
): Promise<Patient | RelatedPerson | undefined> {
  const reference = getActiveAccountGuarantorReference(account);
  if (!reference?.startsWith('RelatedPerson/')) return getResponsiblePartyFromAccount(account, [patient]);
  return oystehr.fhir.get<RelatedPerson>({
    resourceType: 'RelatedPerson',
    id: reference.slice('RelatedPerson/'.length),
  });
}
