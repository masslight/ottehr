import { AppointmentContext } from 'utils/lib/config-helpers/patient-record';
import { BUCKET_NAMES, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { ServiceMode } from 'utils/lib/types/common';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getReasonForVisitAndAdditionalDetailsFromAppointment } from 'utils/lib/fhir/appointments';
import { getReasonForVisitOptionsForServiceCategory } from 'utils/lib/config-helpers/booking';
import { getVisitOccupationalMedicineEmployerFromEncounter } from 'utils/lib/fhir/encounter';
import { isInPersonAppointment, isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { createClinicalOystehrClient } from '../helpers';
import { DataComposer, generatePdf, PdfRenderConfig, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import { composeAttorneyData, createAttorneyInfoSection } from './sections/attorneyInfo';
import { composeConsentFormsData, createConsentFormsSection } from './sections/consentFormsInfo';
import { composeContactData, createContactInfoSection } from './sections/contactInfo';
import { composeDocumentsData, createDocumentsSection } from './sections/documents';
import { composeEmergencyContactData, createEmergencyContactInfoSection } from './sections/emergencyContactInfo';
import { composeEmployerData, createEmployerInfoSection } from './sections/employerInfo';
import {
  composeInsuranceData,
  createPrimaryInsuranceSection,
  createSecondaryInsuranceSection,
} from './sections/insuranceInfo';
import {
  composeOccupationalMedicineEmployerData,
  createOccupationalMedicineEmployerSection,
} from './sections/occupationalMedicineEmployerInfo';
import { composePatientData, createPatientHeader, createPatientInfoSection } from './sections/patientInfo';
import { composePatientDetailsData, createPatientDetailsSection } from './sections/patientDetails';
import { composePatientPaymentsData, createPatientPaymentsSection } from './sections/patientPayments';
import { composePharmacyData, createPharmacyFormsSection } from './sections/pharmacyInfo';
import { composeResponsiblePartyData, createResponsiblePartySection } from './sections/responsiblePartyInfo';
import { composeVisitData, createVisitInfoSection } from './sections/visitInfo';
import { composePrimaryCarePhysicianData, createPrimaryCarePhysicianSection } from './sections/primaryCarePhysician';
import { fetchServiceCategoryCatalog } from './service-category-catalog';
import { AssetPaths, PdfResult, VisitDetailsData, VisitDetailsInput } from './types';

// Build the same `AppointmentContext` the EHR's VisitDetailsPage feeds into
// `usePatientRecordFormSection`, so PDF section triggers evaluate identically.
// In particular, `reasonForVisit` is the first complaint (not the comma-
// joined list) and only set when it matches an option for the service
// category — mirroring VisitDetailsPage.tsx.
const buildAppointmentContext = (input: VisitDetailsInput): AppointmentContext => {
  const { appointment, encounter } = input;
  const appointmentServiceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  let appointmentServiceMode: ServiceMode | undefined;
  if (isInPersonAppointment(appointment)) appointmentServiceMode = ServiceMode['in-person'];
  else if (isTelemedAppointment(appointment)) appointmentServiceMode = ServiceMode.virtual;

  const { reasonForVisit: firstComplaint } = getReasonForVisitAndAdditionalDetailsFromAppointment(appointment);
  const validReasons = firstComplaint
    ? getReasonForVisitOptionsForServiceCategory(appointmentServiceCategory ?? '')
    : [];
  const reasonForVisit = validReasons.some((option) => option.value === firstComplaint) ? firstComplaint : undefined;

  return {
    appointmentServiceCategory,
    appointmentServiceMode,
    reasonForVisit,
    encounterId: encounter?.id,
    visitOccupationalMedicineEmployerReference: encounter
      ? getVisitOccupationalMedicineEmployerFromEncounter(encounter)
      : undefined,
  };
};

const composeVisitDetailsData: DataComposer<VisitDetailsInput, VisitDetailsData> = (input) => {
  const {
    patient,
    emergencyContactResource,
    attorneyRelatedPerson,
    employerOrganization,
    occupationalMedicineEmployerOrganization,
    appointment,
    encounter,
    location,
    timezone,
    physician,
    pharmacy,
    coverages,
    insuranceOrgs,
    guarantorResource,
    documents,
    consents,
    questionnaireResponse,
    payments,
  } = input;

  return {
    appointmentContext: buildAppointmentContext(input),
    patient: composePatientData({ patient, appointment }),
    visit: composeVisitData({ appointment, location, timezone, serviceCategories: input.serviceCategories }),
    contact: composeContactData({ patient, appointment }),
    details: composePatientDetailsData({ patient }),
    pcp: composePrimaryCarePhysicianData({ physician }),
    pharmacy: composePharmacyData(pharmacy),
    insurances: composeInsuranceData({ coverages, insuranceOrgs }),
    responsibleParty: composeResponsiblePartyData({ guarantorResource }),
    consentForms: composeConsentFormsData({ encounter, consents, questionnaireResponse, timezone }),
    documents: composeDocumentsData(documents),
    emergencyContact: composeEmergencyContactData({ emergencyContactResource }),
    attorney: composeAttorneyData({ attorneyRelatedPerson }),
    employer: composeEmployerData({
      employer: employerOrganization,
      workersCompCoverage: coverages.workersComp,
      insuranceOrgs,
    }),
    omEmployer: composeOccupationalMedicineEmployerData({ employer: occupationalMedicineEmployerOrganization }),
    paymentHistory: composePatientPaymentsData({ payments }),
  };
};

const visitDetailsAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Medium.ttf',
  },
};

const createVisitDetailsStyles: StyleFactory = (assets) => ({
  textStyles: {
    header: {
      fontSize: 16,
      font: assets.fonts.bold,
      side: 'right' as const,
      spacing: 5,
      newLineAfter: true,
    },
    subHeader: {
      fontSize: 14,
      font: assets.fonts.bold,
      spacing: 5,
      newLineAfter: true,
    },
    regular: {
      fontSize: 11,
      font: assets.fonts.regular,
      spacing: 2,
      newLineAfter: true,
    },
    patientName: {
      fontSize: 16,
      font: assets.fonts.bold,
      spacing: 5,
      newLineAfter: true,
    },
  },
  lineStyles: {
    separator: {
      thickness: 1,
      color: rgbNormalized(227, 230, 239),
      margin: { top: 8, bottom: 8 },
    },
  },
});

const visitDetailsRenderConfig: PdfRenderConfig<VisitDetailsData> = {
  header: {
    title: 'VISIT DETAILS',
    leftSection: createPatientHeader(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: visitDetailsAssetPaths,
  styleFactory: createVisitDetailsStyles,
  sections: [
    { ...createPatientInfoSection(), preferredWidth: 'column' },
    { ...createPrimaryInsuranceSection(), preferredWidth: 'column' },
    { ...createContactInfoSection(), preferredWidth: 'column' },
    { ...createPharmacyFormsSection(), preferredWidth: 'column' },
    { ...createSecondaryInsuranceSection(), preferredWidth: 'column' },
    { ...createPatientDetailsSection(), preferredWidth: 'column' },
    { ...createPrimaryCarePhysicianSection(), preferredWidth: 'column' },
    { ...createResponsiblePartySection(), preferredWidth: 'column' },
    { ...createEmployerInfoSection(), preferredWidth: 'column' },
    { ...createOccupationalMedicineEmployerSection(), preferredWidth: 'column' },
    { ...createEmergencyContactInfoSection(), preferredWidth: 'column' },
    { ...createAttorneyInfoSection(), preferredWidth: 'column' },
    { ...createConsentFormsSection(), preferredWidth: 'column' },
    { ...createPatientPaymentsSection(), preferredWidth: 'column' },
    createDocumentsSection(),
  ],
};

export const createVisitDetailsPdf = async (
  input: VisitDetailsInput,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  const serviceCategories = await fetchServiceCategoryCatalog(createClinicalOystehrClient(token, secrets));
  return generatePdf(
    { ...input, serviceCategories },
    composeVisitDetailsData,
    visitDetailsRenderConfig,
    {
      patientId: input.patient.id!,
      fileName: 'VisitDetails.pdf',
      bucketName: BUCKET_NAMES.VISIT_NOTES,
    },
    secrets,
    token
  );
};
