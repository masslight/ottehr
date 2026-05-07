import { BUCKET_NAMES, Secrets } from 'utils';
import { DataComposer, generatePdf, PdfRenderConfig, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import {
  composeDiagnoses,
  composeDisposition,
  composePatientInformationForDischargeSummary,
  composePatientInstructions,
  composeVisitData,
  composeWorkSchoolExcuseSection,
  createDiagnosesSection,
  createDispositionSection,
  createPatientHeaderForDischargeSummary,
  createPatientInstructionsSection,
  createVisitInfoSection,
  createWorkSchoolExcuseSection,
} from './sections';
import {
  AssetPaths,
  DiagnosesData,
  DischargeSummaryInput,
  DispositionData,
  PatientInfoForDischargeSummary,
  PatientInstructionsData,
  PdfData,
  PdfResult,
  VisitInfo,
  WorkSchoolExcuseData,
} from './types';

export interface PatientInstructionsPdfData extends PdfData {
  patient: PatientInfoForDischargeSummary;
  visit: VisitInfo;
  diagnoses?: DiagnosesData;
  patientInstructions?: PatientInstructionsData;
  disposition: DispositionData;
  workSchoolExcuse?: WorkSchoolExcuseData;
}

const composePatientInstructionsPdfData: DataComposer<DischargeSummaryInput, PatientInstructionsPdfData> = (input) => {
  const { allChartData, appointmentPackage } = input;
  const { appointment, location, timezone } = appointmentPackage;
  return {
    patient: composePatientInformationForDischargeSummary({ appointmentPackage }),
    visit: composeVisitData({ appointment, location, timezone }),
    diagnoses: composeDiagnoses({ allChartData }),
    patientInstructions: composePatientInstructions({ allChartData }),
    disposition: composeDisposition({ allChartData }),
    workSchoolExcuse: composeWorkSchoolExcuseSection({ allChartData }),
  };
};

const patientInstructionsAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Medium.ttf',
  },
  icons: {
    call: './assets/call.png',
    inconclusive: './assets/inconclusive.png',
    abnormal: './assets/abnormal.png',
    normal: './assets/normal.png',
  },
};

const createPatientInstructionsStyles: StyleFactory = (assets) => ({
  textStyles: {
    header: {
      fontSize: 16,
      font: assets.fonts.bold,
      side: 'right',
      spacing: 5,
      newLineAfter: true,
    },
    patientName: {
      fontSize: 16,
      font: assets.fonts.bold,
      spacing: 5,
      newLineAfter: true,
    },
    subHeader: {
      fontSize: 14,
      font: assets.fonts.bold,
      spacing: 5,
      newLineAfter: true,
    },
    attachmentTitle: {
      fontSize: 12,
      font: assets.fonts.regular,
      color: rgbNormalized(102, 102, 102),
      spacing: 2,
      newLineAfter: true,
    },
    regular: {
      fontSize: 12,
      font: assets.fonts.regular,
      spacing: 2,
      newLineAfter: true,
    },
    regularText: {
      fontSize: 12,
      font: assets.fonts.regular,
      spacing: 2,
      newLineAfter: true,
    },
    bold: {
      fontSize: 12,
      font: assets.fonts.bold,
      spacing: 2,
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

const patientInstructionsRenderConfig: PdfRenderConfig<PatientInstructionsPdfData> = {
  header: {
    title: 'PATIENT INSTRUCTIONS',
    leftSection: createPatientHeaderForDischargeSummary(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: patientInstructionsAssetPaths,
  styleFactory: createPatientInstructionsStyles,
  sections: [
    createDiagnosesSection(),
    createPatientInstructionsSection(),
    createDispositionSection(),
    createWorkSchoolExcuseSection(),
  ],
};

export const createPatientInstructionsPdf = async (
  input: DischargeSummaryInput,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  return generatePdf(
    input,
    composePatientInstructionsPdfData,
    patientInstructionsRenderConfig,
    {
      patientId: input.appointmentPackage.patient!.id!,
      fileName: 'PatientInstructions.pdf',
      bucketName: BUCKET_NAMES.PATIENT_INSTRUCTIONS,
    },
    secrets,
    token
  );
};
