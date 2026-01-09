import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner } from 'fhir/r4b';
import {
  checkForStripeCustomerDeletedError,
  getConsentAndRelatedDocRefsForAppointment,
  getSecret,
  PatientPaymentDTO,
  Secrets,
  SecretsKeys,
  VisitDetailsResponse,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getStripeClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { makeVisitDetailsPdfDocumentReference } from '../../../shared/pdf/make-visit-details-document-reference';
import { createVisitDetailsPdf } from '../../../shared/pdf/visit-details-pdf';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { getPaymentsForEncounter } from '../../patient-payments/helpers';
import { getAccountAndCoverageResourcesForPatient, PATIENT_CONTAINED_PHARMACY_ID } from '../../shared/harvest';
import { searchDocumentReferencesForVisit } from '../get-visit-files';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'visit-details-to-pdf';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);

  try {
    const validatedParameters = validateRequestParameters(input);
    const { appointmentId, timezone, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, appointmentId, secrets, timezone);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('visit-details-to-pdf', error, ENVIRONMENT);
  }
});

export const performEffect = async (
  oystehr: Oystehr,
  appointmentId: string,
  secrets: Secrets | null,
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

  const [consentResources, accountResources, documentReferences] = await Promise.all([
    getConsentAndRelatedDocRefsForAppointment({ appointmentId, patientId: patient.id }, oystehr),
    getAccountAndCoverageResourcesForPatient(patient.id, oystehr),
    searchDocumentReferencesForVisit(oystehr, patient.id, appointmentId),
  ]);
  const { consents } = consentResources;

  const { account, coverages, insuranceOrgs, guarantorResource, emergencyContactResource, employerOrganization } =
    accountResources;
  const primaryCarePhysician = accountResources.patient?.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.active === true
  ) as Practitioner;
  let payments: PatientPaymentDTO[] = [];
  if (encounter.id && account) {
    try {
      const stripeClient = getStripeClient(secrets);
      payments = await getPaymentsForEncounter({
        oystehrClient: oystehr,
        stripeClient,
        account,
        encounterId: encounter.id,
        patientId: patient.id,
      });
    } catch (error) {
      console.error('Failed to fetch payments for PDF generation:', error);
      try {
        checkForStripeCustomerDeletedError(error);
      } catch (customerError) {
        console.error(`Error: Stripe customer deleted, PDF will be generated without payment info. ${customerError}`);
      }

      payments = [];
    }
  }
  const pharmacy = accountResources.patient?.contained?.find(
    (resource) => resource.resourceType === 'Organization' && resource.id === PATIENT_CONTAINED_PHARMACY_ID
  ) as Organization;
  const { pdfInfo, attached } = await createVisitDetailsPdf(
    {
      patient,
      emergencyContactResource,
      employerOrganization,
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
    },
    secrets,
    m2mToken
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
