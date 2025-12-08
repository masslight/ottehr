import { BUCKET_NAMES, Secrets } from 'utils';
import { DataComposer, generatePdf, PdfRenderConfig, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import {
  composePatientData,
  composePatientDetailsData,
  composeVisitData,
  createPatientDetailsSection,
  createPatientHeader,
  createPatientInfoSection,
  createVisitInfoSection,
} from './sections';
import { composeConsentFormsData, createConsentFormsSection } from './sections/consentFormsInfo';
import { composeContactData, createContactInfoSection } from './sections/contactInfo';
import { composeDocumentsData, createDocumentsSection } from './sections/documents';
import {
  composeInsuranceData,
  createPrimaryInsuranceSection,
  createSecondaryInsuranceSection,
} from './sections/insuranceInfo';
import { composeResponsiblePartyData, createResponsiblePartySection } from './sections/responsiblePartyInfo';
import { AssetPaths, PdfResult, VisitDetailsData, VisitDetailsInput } from './types';

const composeVisitDetailsData: DataComposer<VisitDetailsInput, VisitDetailsData> = (input) => {
  const {
    patient,
    appointment,
    location,
    timezone,
    physician,
    coverages,
    insuranceOrgs,
    guarantorResource,
    documents,
    consents,
    questionnaireResponse,
  } = input;

  return {
    patient: composePatientData({ patient, appointment }),
    visit: composeVisitData({ appointment, location, timezone }),
    contact: composeContactData({ patient, appointment }),
    details: composePatientDetailsData({ patient, physician }),
    insurances: composeInsuranceData({ coverages, insuranceOrgs }),
    responsibleParty: composeResponsiblePartyData({ guarantorResource }),
    consentForms: composeConsentFormsData({ consents, questionnaireResponse, timezone }),
    documents: composeDocumentsData(documents),
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
    { ...createSecondaryInsuranceSection(), preferredWidth: 'column' },
    { ...createPatientDetailsSection(), preferredWidth: 'column' },
    { ...createResponsiblePartySection(), preferredWidth: 'column' },
    { ...createConsentFormsSection(), preferredWidth: 'column' },
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
