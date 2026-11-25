import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Encounter, Organization, PaymentNotice, Practitioner } from 'fhir/r4b';
import { getConsentAndRelatedDocRefsForAppointment } from 'utils/lib/fhir/appointments';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { Secrets } from 'utils/lib/secrets';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';
import { VisitDetailsResponse } from 'utils/lib/types/api/visit-details/visit-details.types';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import { checkForStripeCustomerDeletedError } from 'utils/lib/types/errors';
import { getPaymentsForEncounter } from '../../../billing/patient-payment-dtos';
import { fetchEncounterPaymentNotices } from '../../../billing/patient-payments';
import { createBillingClient } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import {
  getOccupationalMedicineEmployerName,
  getVisitEmployerOrganizationId,
} from '../../../shared/occupational-medicine-employer';
import { makeVisitDetailsPdfDocumentReference } from '../../../shared/pdf/make-visit-details-document-reference';
import { fetchServiceCategoryCatalog } from '../../../shared/pdf/service-category-catalog';
import { createVisitDetailsPdf } from '../../../shared/pdf/visit-details-pdf';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { wrapHandler } from '../../../shared/sentry';
import { getStripeClient } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { getAccountAndCoverageResourcesForPatient, PATIENT_CONTAINED_PHARMACY_ID } from '../../shared/harvest';
import { searchDocumentReferencesForVisit } from '../get-visit-files';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'visit-details-to-pdf';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  const { appointmentId, timezone, secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  console.log('Created Oystehr client');

  const response = await performEffect(oystehr, appointmentId, secrets, m2mToken, timezone);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const performEffect = async (
  oystehr: Oystehr,
  appointmentId: string,
  secrets: Secrets | null,
  token: string,
  timezone?: string
): Promise<VisitDetailsResponse> => {
  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }

  const {
    appointment,
    encounter,
    patient,
    location,
    timezone: resourceTimezone,
    listResources,
    questionnaireResponse,
  } = visitResources;
  const effectiveTimezone = timezone ?? resourceTimezone;

  if (!patient?.id) {
    throw new Error(`Patient data is missing for appointment ${appointmentId}`);
  }

  console.log('Chart data received');

  const patientId = patient.id;
  const encounterId = encounter.id;
  const appointmentServiceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;

  const fetchPaymentNotices = async (
    paymentEncounterId: string
  ): Promise<{ notices: PaymentNotice[] } | { error: unknown }> => {
    try {
      const noticesByEncounter = await fetchEncounterPaymentNotices({
        clinicalOystehr: oystehr,
        billingOystehr: createBillingClient(token, secrets),
        encounterIds: [paymentEncounterId],
      });
      return { notices: noticesByEncounter.get(paymentEncounterId) ?? [] };
    } catch (error) {
      return { error };
    }
  };

  const getPayments = async (
    account: Account | undefined,
    paymentNotices: { notices: PaymentNotice[] } | { error: unknown } | undefined
  ): Promise<PatientPaymentDTO[]> => {
    if (!encounterId || !account || !paymentNotices) return [];
    try {
      const stripeClient = getStripeClient(secrets);
      if ('error' in paymentNotices) throw paymentNotices.error;
      return await getPaymentsForEncounter({
        clinicalOystehr: oystehr,
        billingOystehr: createBillingClient(token, secrets),
        stripeClient,
        account,
        encounterId,
        fhirPaymentNotices: paymentNotices.notices,
      });
    } catch (error) {
      console.error('Failed to fetch payments for PDF generation:', error);
      try {
        checkForStripeCustomerDeletedError(error);
      } catch (customerError) {
        console.error(`Error: Stripe customer deleted, PDF will be generated without payment info. ${customerError}`);
      }

      return [];
    }
  };

  const loadAccountDetails = async (): Promise<{
    accountResources: PatientAccountAndCoverageResources;
    payments: PatientPaymentDTO[];
    occupationalMedicineEmployerName: string | undefined;
  }> => {
    const [accountResources, paymentNotices] = await Promise.all([
      getAccountAndCoverageResourcesForPatient(patientId, oystehr),
      encounterId ? fetchPaymentNotices(encounterId) : undefined,
    ]);
    const [payments, occupationalMedicineEmployerName] = await Promise.all([
      getPayments(accountResources.account, paymentNotices),
      resolveOccupationalMedicineEmployerName({
        oystehr,
        encounter,
        appointmentServiceCategory,
        occupationalMedicineEmployerOrganization: accountResources.occupationalMedicineEmployerOrganization,
        occupationalMedicineAccount: accountResources.occupationalMedicineAccount,
      }),
    ]);
    return { accountResources, payments, occupationalMedicineEmployerName };
  };

  const [
    consentResources,
    { accountResources, payments, occupationalMedicineEmployerName },
    documentReferences,
    serviceCategories,
  ] = await Promise.all([
    getConsentAndRelatedDocRefsForAppointment({ appointmentId, patientId }, oystehr),
    loadAccountDetails(),
    searchDocumentReferencesForVisit(oystehr, patientId, appointmentId),
    fetchServiceCategoryCatalog(createClinicalOystehrClient(token, secrets)),
  ]);
  const { consents } = consentResources;

  const {
    coverages,
    insuranceOrgs,
    guarantorResource,
    emergencyContactResource,
    attorneyRelatedPerson,
    employerOrganization,
  } = accountResources;
  const primaryCarePhysician = accountResources.patient?.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.active === true
  ) as Practitioner;
  const pharmacy = accountResources.patient?.contained?.find(
    (resource) => resource.resourceType === 'Organization' && resource.id === PATIENT_CONTAINED_PHARMACY_ID
  ) as Organization;

  const { pdfInfo, attached } = await createVisitDetailsPdf(
    {
      patient,
      emergencyContactResource,
      attorneyRelatedPerson,
      employerOrganization,
      occupationalMedicineEmployerName,
      appointment,
      encounter,
      location,
      timezone: effectiveTimezone,
      physician: primaryCarePhysician,
      pharmacy,
      coverages,
      insuranceOrgs,
      guarantorResource,
      documents: documentReferences || [],
      consents: consents || [],
      questionnaireResponse,
      payments,
      serviceCategories,
    },
    secrets,
    token
  );

  console.log(`Creating Visit details PDF Document Reference`);
  const documentReference = await makeVisitDetailsPdfDocumentReference(
    oystehr,
    pdfInfo,
    patient.id,
    appointmentId,
    encounter.id!,
    listResources,
    attached
  );
  const visitDetailsDocumentId = documentReference.id ?? '';

  return {
    documentReference: `DocumentReference/${visitDetailsDocumentId}`,
  };
};

// The employer line on the visit PDF, as a name only — NIO employers are billing-app resources the
// clinical side never reads as FHIR, so their names come from the stored Reference display.
export async function resolveOccupationalMedicineEmployerName(params: {
  oystehr: Oystehr;
  encounter: Encounter;
  appointmentServiceCategory?: string;
  occupationalMedicineEmployerOrganization?: Organization;
  occupationalMedicineAccount?: Account;
}): Promise<string | undefined> {
  const {
    oystehr,
    encounter,
    appointmentServiceCategory,
    occupationalMedicineEmployerOrganization,
    occupationalMedicineAccount,
  } = params;

  const visitEmployerOrganizationId =
    appointmentServiceCategory === 'pre-op' ? getVisitEmployerOrganizationId(encounter) : undefined;

  const visitEmployerOrganization = visitEmployerOrganizationId
    ? await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: visitEmployerOrganizationId })
    : undefined;

  return getOccupationalMedicineEmployerName({
    encounter,
    appointmentServiceCategory,
    occupationalMedicineEmployerOrganization,
    occupationalMedicineAccount,
    visitEmployerOrganization,
  });
}
