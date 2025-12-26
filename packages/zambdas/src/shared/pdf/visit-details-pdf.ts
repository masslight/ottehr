import { BUCKET_NAMES, Secrets } from 'utils';
import { DataComposer, generatePdf, PdfRenderConfig, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import {
  composeConsentFormsData,
  composeContactData,
  composeDocumentsData,
  composeEmergencyContactData,
  composeEmployerData,
  composeInsuranceData,
  composePatientData,
  composePatientDetailsData,
  composePatientPaymentsData,
  composePharmacyData,
  composeResponsiblePartyData,
  composeVisitData,
  createConsentFormsSection,
  createContactInfoSection,
  createDocumentsSection,
  createEmergencyContactInfoSection,
  createEmployerInfoSection,
  createPatientDetailsSection,
  createPatientHeader,
  createPatientInfoSection,
  createPatientPaymentsSection,
  createPharmacyFormsSection,
  createPrimaryInsuranceSection,
  createResponsiblePartySection,
  createSecondaryInsuranceSection,
  createVisitInfoSection,
} from './sections';
import { composePrimaryCarePhysicianData, createPrimaryCarePhysicianSection } from './sections/primaryCarePhysician';
import { AssetPaths, PdfResult, VisitDetailsData, VisitDetailsInput } from './types';

const composeVisitDetailsData: DataComposer<VisitDetailsInput, VisitDetailsData> = (input) => {
  const {
    patient,
    emergencyContactResource,
    employerOrganization,
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
    patient: composePatientData({ patient, appointment }),
    visit: composeVisitData({ appointment, location, timezone }),
    contact: composeContactData({ patient, appointment }),
    details: composePatientDetailsData({ patient }),
    pcp: composePrimaryCarePhysicianData({ physician }),
    pharmacy: composePharmacyData(pharmacy),
    insurances: composeInsuranceData({ coverages, insuranceOrgs }),
    responsibleParty: composeResponsiblePartyData({ guarantorResource }),
    consentForms: composeConsentFormsData({ encounter, consents, questionnaireResponse, timezone }),
    documents: composeDocumentsData(documents),
    emergencyContact: composeEmergencyContactData({ emergencyContactResource }),
    employer: composeEmployerData({ employer: employerOrganization }),
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
    { ...createEmergencyContactInfoSection(), preferredWidth: 'column' },
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
  return generatePdf(
    input,
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
