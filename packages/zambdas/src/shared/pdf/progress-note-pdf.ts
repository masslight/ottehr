import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { getQuestionnaireResponseByLinkId } from 'utils/lib/helpers/paperwork/paperwork-response';
import { Secrets } from 'utils/lib/secrets';
import { createClinicalOystehrClient } from '../helpers';
import { clinicalDocumentAssetPaths, createClinicalDocumentStyles } from './clinical-document-theme';
import { DataComposer, PdfRenderConfig, renderPdf, StyleFactory, uploadPdfToStorage } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import {
  composePatientInformationForDischargeSummary,
  createCompactPatientHeader,
} from './sections/discharge-summary/patientInfo';
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
import { composeDmeOrders, createDmeOrdersSection } from './sections/visit-note/dme';
import { composeEmCode, createEmCodeSection } from './sections/visit-note/emCode';
import { composeEncounterData } from './sections/visit-note/encounterInfo';
import { composeExamination, createExaminationSection } from './sections/visit-note/examination';
import { composeExternalLabs, createExternalLabsSection } from './sections/visit-note/externalLabsInfo';
import { composeFollowupCompleted, createFollowupCompletedSection } from './sections/visit-note/followupCompleted';
import { composeFormResponses, createQuestionnairesSection } from './sections/visit-note/formResponses';
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
  composeProgressNoteVisitDetails,
  createProgressNoteVisitDetailsSection,
} from './sections/visit-note/progressNoteVisitDetails';
import { composeReviewOfSystems, createReviewOfSystemsSection } from './sections/visit-note/reviewOfSystems';
import { composeRosObservations, createRosObservationsSection } from './sections/visit-note/rosObservations';
import { composeSignature, createSignatureSection } from './sections/visit-note/signature';
import { composeSurgicalHistory, createSurgicalHistorySection } from './sections/visit-note/surgicalHistory';
import { composeVitals, createVitalsSection } from './sections/visit-note/vitals';
import { composeVisitData, createVisitInfoSection } from './sections/visitInfo';
import { fetchServiceCategoryCatalog } from './service-category-catalog';
import { AssetPaths, PatientInfoForDischargeSummary, PdfResult, ProgressNoteData, ProgressNoteInput } from './types';

/**
 * The discharge summary's patient header, except that the phone stays the guardian's paperwork number the
 * old "Patient information" section showed, falling back to the patient's own phone.
 */
const composeProgressNoteHeaderPatient = (
  appointmentPackage: ProgressNoteInput['appointmentPackage']
): PatientInfoForDischargeSummary => {
  const patient = composePatientInformationForDischargeSummary({ appointmentPackage });
  const guardianPhone = getQuestionnaireResponseByLinkId(
    'guardian-number',
    appointmentPackage.questionnaireResponse
  )?.answer?.[0]?.valueString?.trim();
  // standardizePhoneNumber only formats US numbers; anything else is shown as entered, as before.
  return { ...patient, phone: standardizePhoneNumber(guardianPhone) ?? (guardianPhone || patient.phone) };
};

export const composeProgressNoteData: DataComposer<ProgressNoteInput, ProgressNoteData> = (input) => {
  const { encounter, allChartData, appointmentPackage, upcomingFollowUps } = input;

  const visit = composeProgressNoteVisitDetails({ allChartData, appointmentPackage });
  const encounterInfo = composeEncounterData({ encounter });

  return {
    patient: composeProgressNoteHeaderPatient(appointmentPackage),
    // A follow-up note is not the appointment's visit, so its header carries no visit date/location.
    visitHeader: encounterInfo.isFollowup
      ? undefined
      : composeVisitData({
          appointment: appointmentPackage.appointment,
          location: appointmentPackage.location,
          timezone: appointmentPackage.timezone,
          serviceCategories: input.serviceCategories,
        }),
    encounter: encounterInfo,
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
      formResponses: input.formResponses,
    }),
    questionnaires: { forms: composeFormResponses(input.formResponses, 'questionnaires') },
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
    dmeOrders: composeDmeOrders({ dmeOrders: input.dmeOrders }),
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
  fonts: clinicalDocumentAssetPaths.fonts,
  icons: {
    ...clinicalDocumentAssetPaths.icons,
    redDot: './assets/red-dot.png',
    greenDot: './assets/green-dot.png',
  },
};

/**
 * The discharge summary / visit details look (12pt body, 14pt section titles, compact header) plus the
 * styles only the visit note sections use. Kept at that scale so a printed note takes as few pages as the
 * other clinical documents.
 */
const createProgressNoteStyles: StyleFactory = (assets) => {
  const clinicalStyles = createClinicalDocumentStyles(assets);
  const { regular, bold, muted } = clinicalStyles.textStyles;
  const label = { ...bold, newLineAfter: false };
  const small = { ...regular, fontSize: 10 };

  return {
    textStyles: {
      ...clinicalStyles.textStyles,
      blockSubHeader: bold,
      fieldHeader: label,
      fieldText: regular,
      alternativeRegularText: muted,
      smallText: small,
      smallGreyText: { ...small, color: muted.color },
      examCardHeader: label,
      examBoldField: { ...label, spacing: 4 },
      examAbnormalField: { ...label, spacing: 4, color: rgbNormalized(211, 47, 47) },
      examRegularField: { ...regular, spacing: 4, newLineAfter: false },
      examProviderComment: { ...bold, spacing: 6 },
      pageNumber: { ...small, newLineAfter: false, color: muted.color },
    },
    lineStyles: {
      ...clinicalStyles.lineStyles,
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
        width: 8,
        height: 8,
      },
    },
  };
};

// exported for unit tests
export const progressNoteRenderConfig: PdfRenderConfig<ProgressNoteData> = {
  header: {
    title: (data) => (data.encounter.isFollowup ? 'FOLLOW-UP VISIT NOTE' : 'VISIT NOTE'),
    leftSection: createCompactPatientHeader(),
    rightSection: { ...createVisitInfoSection(), dataSelector: (data) => data.visitHeader },
  },
  headerBodySeparator: true,
  numberPages: true,
  assetPaths: progressNoteAssetPaths,
  styleFactory: createProgressNoteStyles,
  sections: [
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
    createQuestionnairesSection(),
    createIntakeNotesSection(),
    createVitalsSection(),
    createExaminationSection(),
    createAssessmentSection(),
    createMedicalDecisionSection(),
    createEmCodeSection(),
    createCptCodesSection(),
    createProceduresSection(),
    createDmeOrdersSection(),
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
