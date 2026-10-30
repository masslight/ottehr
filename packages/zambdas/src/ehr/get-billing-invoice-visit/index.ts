import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Patient, RelatedPerson } from 'fhir/r4b';
import { getRelatedPersonsForPatient } from 'utils/lib/auth/user-auth.helper';
import { getActiveAccountGuarantorReference, getResponsiblePartyFromAccount } from 'utils/lib/fhir/helpers';
import {
  getEmailForIndividual,
  getFullName,
  getPhoneNumberForIndividual,
  mapGenderToLabel,
} from 'utils/lib/fhir/patient';
import {
  GET_BILLING_INVOICE_VISIT_ZAMBDA_KEY,
  GetBillingInvoiceVisitInputSchema,
} from 'utils/lib/types/api/invoicing.types';
import { GetBillingInvoiceRecipientResponse } from 'utils/lib/types/data/billing/billing.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { formatDateConfigurable } from 'utils/lib/utils/dateUtils';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient, resolveTimezone } from '../../shared/helpers';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { getInvoiceVisitResources } from '../../shared/invoice-visit';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

let m2mToken: string;

const ZAMBDA_NAME = GET_BILLING_INVOICE_VISIT_ZAMBDA_KEY;

// Read only. The billing app's Send Invoice dialog shows who the invoice and SMS will go to.
// The patient, the responsible party and the portal users are clinical records, so they are read here.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { encounterId, secrets } = validateWithSchema(GetBillingInvoiceVisitInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await performEffect(oystehr, encounterId);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  encounterId: string
): Promise<GetBillingInvoiceRecipientResponse> {
  const { patient, account, appointment, location, schedule } = await getInvoiceVisitResources(oystehr, encounterId);
  const responsibleParty = await getResponsibleParty(oystehr, account, patient);
  // The SMS goes to the patient's portal users, so show their number like the EHR dialog does.
  const [portalUser] = await getRelatedPersonsForPatient(patient.id!, oystehr);

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
