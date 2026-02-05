import { BUCKET_NAMES, Secrets } from 'utils';
import { DataComposer, generatePdf, PdfRenderConfig, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import {
  composeAdditionalQuestions,
  composeAllergies,
  composeAssessment,
  composeChiefComplaintAndHistoryOfPresentIllness,
  composeCptCodes,
  composeEmCode,
  composeEncounterData,
  composeExamination,
  composeExternalLabs,
  composeFollowupCompleted,
  composeHospitalization,
  composeImmunizationOrders,
  composeInHouseLabs,
  composeInHouseMedications,
  composeIntakeNotes,
  composeMechanismOfInjury,
  composeMedicalConditions,
  composeMedicalDecision,
  composeMedications,
  composePatientInformation,
  composePlanData,
  composePrescriptions,
  composeProcedures,
  composeProgressNoteVisitDetails,
  composeReviewOfSystems,
  composeSurgicalHistory,
  composeVitals,
  createAdditionalQuestionsSection,
  createAllergiesSection,
  createAssessmentSection,
  createChiefComplaintAndHistoryOfPresentIllnessSection,
  createCptCodesSection,
  createEmCodeSection,
  createExaminationSection,
  createExternalLabsSection,
  createFollowupCompletedSection,
  createHospitalizationSection,
  createImmunizationOrdersSection,
  createInHouseLabsSection,
  createInHouseMedicationsSection,
  createIntakeNotesSection,
  createMechanismOfInjurySection,
  createMedicalConditionsSection,
  createMedicalDecisionSection,
  createMedicationsSection,
  createPlanSection,
  createPrescriptionsSection,
  createProceduresSection,
  createProgressNotePatientInfoSection,
  createProgressNoteVisitDetailsSection,
  createReviewOfSystemsSection,
  createSurgicalHistorySection,
  createVitalsSection,
} from './sections';
import { AssetPaths, PdfResult, ProgressNoteData, ProgressNoteInput } from './types';

const composeProgressNoteData: DataComposer<ProgressNoteInput, ProgressNoteData> = (input) => {
  const { patient, encounter, questionnaireResponse, allChartData, appointmentPackage } = input;

  return {
    patient: composePatientInformation({ patient, questionnaireResponse }),
    encounter: composeEncounterData({ encounter }),
    visit: composeProgressNoteVisitDetails({ allChartData, appointmentPackage }),
    chiefComplaintAndHistoryOfPresentIllness: composeChiefComplaintAndHistoryOfPresentIllness({
      allChartData,
      appointmentPackage,
    }),
    mechanismOfInjury: composeMechanismOfInjury({
      allChartData,
    }),
    reviewOfSystems: composeReviewOfSystems({
      allChartData,
    }),
    medications: composeMedications({
      allChartData,
    }),
    allergies: composeAllergies({
      allChartData,
    }),
    medicalConditions: composeMedicalConditions({
      allChartData,
    }),
    surgicalHistory: composeSurgicalHistory({
      allChartData,
      appointmentPackage,
    }),
    hospitalization: composeHospitalization({
      allChartData,
    }),
    inHouseMedications: composeInHouseMedications({
      allChartData,
    }),
    immunizationOrders: composeImmunizationOrders({
      allChartData,
    }),
    inHouseLabs: composeInHouseLabs({
      allChartData,
    }),
    externalLabs: composeExternalLabs({
      allChartData,
    }),
    screening: composeAdditionalQuestions({
      allChartData,
    }),
    intakeNotes: composeIntakeNotes({
      allChartData,
    }),
    vitals: composeVitals({
      allChartData,
      appointmentPackage,
    }),
    examination: composeExamination({
      allChartData,
      appointmentPackage,
    }),
    assessment: composeAssessment({
      allChartData,
    }),
    medicalDecision: composeMedicalDecision({
      allChartData,
    }),
    emCode: composeEmCode({
      allChartData,
    }),
    cptCodes: composeCptCodes({
      allChartData,
    }),
    procedures: composeProcedures({
      allChartData,
    }),
    prescriptions: composePrescriptions({
      allChartData,
    }),
    plan: composePlanData({
      allChartData,
    }),
    patientInstructions: composePlanData({
      allChartData,
    }),
    followupCompleted: composeFollowupCompleted({
      appointmentPackage,
    }),
  };
};

const progressNoteAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Bold.otf',
  },
  icons: {
    redDot: './assets/red-dot.png',
    greenDot: './assets/green-dot.png',
    abnormal: './assets/abnormal.png',
    inconclusive: './assets/inconclusive.png',
    normal: './assets/normal.png',
  },
};

const createProgressNoteStyles: StyleFactory = (assets) => ({
  textStyles: {
    header: {
      fontSize: 20,
      font: assets.fonts.bold,
      spacing: 17,
      side: 'right',
      newLineAfter: true,
    },
    subHeader: {
      fontSize: 18,
      font: assets.fonts.regular,
      spacing: 8,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    blockSubHeader: {
      fontSize: 16,
      spacing: 1,
      font: assets.fonts.bold,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    fieldHeader: {
      fontSize: 16,
      font: assets.fonts.regular,
      spacing: 1,
      color: rgbNormalized(48, 19, 103),
    },
    fieldText: {
      fontSize: 16,
      spacing: 6,
      font: assets.fonts.regular,
      side: 'right',
      newLineAfter: true,
    },
    regularText: {
      fontSize: 16,
      spacing: 1,
      font: assets.fonts.regular,
      newLineAfter: true,
    },
    alternativeRegularText: {
      fontSize: 16,
      spacing: 1,
      color: rgbNormalized(143, 154, 167),
      font: assets.fonts.regular,
      newLineAfter: true,
    },
    smallText: {
      fontSize: 14,
      spacing: 1,
      font: assets.fonts.regular,
      newLineAfter: true,
    },
    smallGreyText: {
      fontSize: 14,
      spacing: 1,
      font: assets.fonts.regular,
      newLineAfter: true,
      color: rgbNormalized(143, 154, 167),
    },
    examCardHeader: {
      fontSize: 16,
      spacing: 1,
      font: assets.fonts.bold,
      color: rgbNormalized(48, 19, 103),
    },
    examBoldField: {
      fontSize: 16,
      spacing: 5,
      font: assets.fonts.bold,
    },
    examRegularField: {
      fontSize: 16,
      spacing: 5,
      font: assets.fonts.regular,
    },
    examProviderComment: {
      fontSize: 16,
      spacing: 16,
      font: assets.fonts.bold,
      newLineAfter: true,
    },
    regular: {
      fontSize: 16,
      spacing: 1,
      font: assets.fonts.regular,
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
    examExtraItemsSeparatedLineStyle: {
      thickness: 1,
      color: rgbNormalized(244, 246, 248),
      margin: {
        right: 200,
      },
    },
  },
  imageStyles: {
    examColorDotsStyle: {
      width: 10,
      height: 10,
    },
  },
});

const progressNoteRenderConfig: PdfRenderConfig<ProgressNoteData> = {
  header: {
    title: (data) => (data.encounter.isFollowup ? 'Follow-up Visit Note' : 'Visit Note'),
    logo: {
      width: 110,
      height: 28,
    },
  },
  headerBodySeparator: false,
  assetPaths: progressNoteAssetPaths,
  styleFactory: createProgressNoteStyles,
  sections: [
    createProgressNotePatientInfoSection(),
    createProgressNoteVisitDetailsSection(),
    createChiefComplaintAndHistoryOfPresentIllnessSection(),
    createMechanismOfInjurySection(),
    createReviewOfSystemsSection(),
    createMedicationsSection(),
    createAllergiesSection(),
    createMedicalConditionsSection(),
    createSurgicalHistorySection(),
    createHospitalizationSection(),
    createInHouseMedicationsSection(),
    createImmunizationOrdersSection(),
    createInHouseLabsSection(),
    createExternalLabsSection(),
    createAdditionalQuestionsSection(),
    createIntakeNotesSection(),
    createVitalsSection(),
    createExaminationSection(),
    createAssessmentSection(),
    createMedicalDecisionSection(),
    createEmCodeSection(),
    createCptCodesSection(),
    createProceduresSection(),
    createPrescriptionsSection(),
    createPlanSection(),
    createFollowupCompletedSection(),
  ],
};

export const createProgressNotePdf = async (
  input: ProgressNoteInput,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  return generatePdf(
    input,
    composeProgressNoteData,
    progressNoteRenderConfig,
    {
      patientId: input.patient.id!,
      fileName: 'VisitNote.pdf',
      bucketName: BUCKET_NAMES.VISIT_NOTES,
    },
    secrets,
    token
  );
};
