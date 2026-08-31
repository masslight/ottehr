import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { createClinicalOystehrClient } from '../helpers';
import { DataComposer, PdfRenderConfig, renderPdf, StyleFactory, uploadPdfToStorage } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import { composeRadiology, createRadiologySection } from './sections/discharge-summary/radiology';
import { composeUpcomingVisits, createUpcomingVisitsSection } from './sections/upcomingVisits';
import {
  composeAdditionalQuestions,
  createAdditionalQuestionsSection,
} from './sections/visit-note/additionalQuestions';
import { composeAllergies, createAllergiesSection } from './sections/visit-note/allergiesInfo';
import { composeAssessment, createAssessmentSection } from './sections/visit-note/assessment';
import { composeChiefComplaint, createChiefComplaintSection } from './sections/visit-note/chiefComplaint';
import { composeCptCodes, createCptCodesSection } from './sections/visit-note/cptCodes';
import { composeEmCode, createEmCodeSection } from './sections/visit-note/emCode';
import { composeEncounterData } from './sections/visit-note/encounterInfo';
import { composeExamination, createExaminationSection } from './sections/visit-note/examination';
import { composeExternalLabs, createExternalLabsSection } from './sections/visit-note/externalLabsInfo';
import { composeFollowupCompleted, createFollowupCompletedSection } from './sections/visit-note/followupCompleted';
import {
  composeHistoryOfPresentIllness,
  createHistoryOfPresentIllnessSection,
} from './sections/visit-note/historyOfPresentIllness';
import { composeHospitalization, createHospitalizationSection } from './sections/visit-note/hospitalizationInfo';
import { composeImmunizationOrders, createImmunizationOrdersSection } from './sections/visit-note/immunization';
import { composeInHouseLabs, createInHouseLabsSection } from './sections/visit-note/inHouseLabsInfo';
import {
  composeInHouseMedications,
  createInHouseMedicationsSection,
} from './sections/visit-note/inHouseMedicationsInfo';
import { composeIntakeNotes, createIntakeNotesSection } from './sections/visit-note/intakeNotes';
import { composeMechanismOfInjury, createMechanismOfInjurySection } from './sections/visit-note/mechanismOfInjury';
import { composeMedicalConditions, createMedicalConditionsSection } from './sections/visit-note/medicalConditions';
import { composeMedicalDecision, createMedicalDecisionSection } from './sections/visit-note/medicalDecision';
import { composeMedications, createMedicationsSection } from './sections/visit-note/medicationsInfo';
import { composePlanData, createPlanSection } from './sections/visit-note/plan';
import { composePrescriptions, createPrescriptionsSection } from './sections/visit-note/prescriptions';
import { composeProcedures, createProceduresSection } from './sections/visit-note/procedures';
import {
  composePatientInformation,
  createProgressNotePatientInfoSection,
} from './sections/visit-note/progressNotePatientInfo';
import {
  composeProgressNoteVisitDetails,
  createProgressNoteVisitDetailsSection,
} from './sections/visit-note/progressNoteVisitDetails';
import { composeReviewOfSystems, createReviewOfSystemsSection } from './sections/visit-note/reviewOfSystems';
import { composeRosObservations, createRosObservationsSection } from './sections/visit-note/rosObservations';
import { composeSignature, createSignatureSection } from './sections/visit-note/signature';
import { composeSurgicalHistory, createSurgicalHistorySection } from './sections/visit-note/surgicalHistory';
import { composeVitals, createVitalsSection } from './sections/visit-note/vitals';
import { fetchServiceCategoryCatalog } from './service-category-catalog';
import { AssetPaths, PdfResult, ProgressNoteData, ProgressNoteInput } from './types';

const composeProgressNoteData: DataComposer<ProgressNoteInput, ProgressNoteData> = (input) => {
  const { patient, encounter, questionnaireResponse, allChartData, appointmentPackage, upcomingFollowUps } = input;

  const visit = composeProgressNoteVisitDetails({
    allChartData,
    appointmentPackage,
    serviceCategories: input.serviceCategories,
  });

  return {
    patient: composePatientInformation({ patient, questionnaireResponse }),
    encounter: composeEncounterData({ encounter }),
    visit,
    chiefComplaint: composeChiefComplaint({
      allChartData,
      appointmentPackage,
    }),
    historyOfPresentIllness: composeHistoryOfPresentIllness({
      allChartData,
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
      appointmentPackage,
    }),
    inHouseLabs: composeInHouseLabs({
      allChartData,
    }),
    externalLabs: composeExternalLabs({
      allChartData,
    }),
    radiology: composeRadiology({
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
    rosObservations: composeRosObservations({
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
      appointmentPackage,
    }),
    prescriptions: composePrescriptions({
      allChartData,
      erxPharmacies: input.erxPharmacies,
    }),
    plan: composePlanData({
      allChartData,
      encounter,
      appointmentPackage,
    }),
    patientInstructions: composePlanData({
      allChartData,
      encounter,
      appointmentPackage,
    }),
    upcomingVisits: composeUpcomingVisits({ upcomingFollowUps }),
    followupCompleted: composeFollowupCompleted({
      appointmentPackage,
    }),
    signature: composeSignature({
      appointmentPackage,
      visit,
      signatures: input.signatures,
      signed: input.signed,
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
    muted: {
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
      maxWidth: 110,
      maxHeight: 28,
    },
  },
  headerBodySeparator: false,
  assetPaths: progressNoteAssetPaths,
  styleFactory: createProgressNoteStyles,
  sections: [
    createProgressNotePatientInfoSection(),
    createProgressNoteVisitDetailsSection(),
    createChiefComplaintSection(),
    createHistoryOfPresentIllnessSection(),
    createMechanismOfInjurySection(),
    createReviewOfSystemsSection(),
    createRosObservationsSection(),
    createMedicationsSection(),
    createAllergiesSection(),
    createMedicalConditionsSection(),
    createSurgicalHistorySection(),
    createHospitalizationSection(),
    createInHouseMedicationsSection(),
    createImmunizationOrdersSection(),
    createInHouseLabsSection(),
    createExternalLabsSection(),
    createRadiologySection(),
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
    createUpcomingVisitsSection(),
    createFollowupCompletedSection(),
    createSignatureSection(),
  ],
};

/**
 * Single render path for the visit/progress note: resolves the service category catalog, composes the
 * note data and renders it. Both the uploading (`createProgressNotePdf`) and the bytes-only
 * (`createProgressNotePdfBytes`) entry points go through here so the note can never drift between the
 * document stored on the visit and the copy merged into an outbound fax packet.
 */
const renderProgressNote = async (
  input: ProgressNoteInput,
  secrets: Secrets | null,
  token: string
): Promise<{ bytes: Uint8Array; data: ProgressNoteData }> => {
  const serviceCategories = await fetchServiceCategoryCatalog(createClinicalOystehrClient(token, secrets));
  const data = composeProgressNoteData({ ...input, serviceCategories });
  return { bytes: await renderPdf(data, progressNoteRenderConfig, token), data };
};

/**
 * Renders the visit/progress note and returns the raw PDF bytes without uploading anything or
 * touching any DocumentReference. Used when the note has to be regenerated on the fly (e.g. for an
 * outbound fax packet of an unsigned visit) and must not become the canonical visit note.
 */
export const createProgressNotePdfBytes = async (
  input: ProgressNoteInput,
  secrets: Secrets | null,
  token: string
): Promise<Uint8Array> => {
  return (await renderProgressNote(input, secrets, token)).bytes;
};

export const createProgressNotePdf = async (
  input: ProgressNoteInput,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  const { bytes, data } = await renderProgressNote(input, secrets, token);

  const pdfInfo = await uploadPdfToStorage(
    bytes,
    {
      patientId: input.patient.id!,
      fileName: 'VisitNote.pdf',
      bucketName: BUCKET_NAMES.VISIT_NOTES,
    },
    secrets,
    token
  );

  return { pdfInfo, attached: data.attachmentDocRefs };
};
