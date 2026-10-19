import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { createClinicalOystehrClient } from '../helpers';
import { clinicalDocumentAssetPaths, createClinicalDocumentStyles } from './clinical-document-theme';
import { DataComposer, generatePdf, PdfRenderConfig } from './pdf-common';
import { createAllergiesSectionForDischargeSummary } from './sections/discharge-summary/allergies';
import { createMedicationsSectionForDischargeSummary } from './sections/discharge-summary/currentMedications';
import { composeDiagnoses, createDiagnosesSection } from './sections/discharge-summary/diagnoses';
import { composeDisposition, createDispositionSection } from './sections/discharge-summary/disposition';
import {
  composeEducationalDocuments,
  createEducationalDocumentsSection,
} from './sections/discharge-summary/educationalDocuments';
import { composeErxMedications, createErxMedicationsSection } from './sections/discharge-summary/erxMedications';
import {
  composeInHouseMedicationsForDischargeSummary,
  createInHouseMedicationsSectionForDischargeSummary,
} from './sections/discharge-summary/inHouseMedications';
import {
  composePatientInformationForDischargeSummary,
  createCompactPatientHeader,
} from './sections/discharge-summary/patientInfo';
import {
  composePatientInstructions,
  createPatientInstructionsSection,
} from './sections/discharge-summary/patientInstructions';
import { composePhysician, createPhysicianSection } from './sections/discharge-summary/physicianInfo';
import { composeRadiology, createRadiologySection } from './sections/discharge-summary/radiology';
import { createReasonForVisitSection } from './sections/discharge-summary/reasonForVisit';
import {
  composeVitalsForDischargeSummary,
  createVitalsSectionForDischargeSummary,
} from './sections/discharge-summary/vitals';
import {
  composeWorkSchoolExcuseSection,
  createWorkSchoolExcuseSection,
} from './sections/discharge-summary/workSchoolExcuse';
import { composeUpcomingVisits, createUpcomingVisitsSection } from './sections/upcomingVisits';
import { composeAllergies } from './sections/visit-note/allergiesInfo';
import { composeExternalLabs, createExternalLabsSection } from './sections/visit-note/externalLabsInfo';
import { composeInHouseLabs, createInHouseLabsSection } from './sections/visit-note/inHouseLabsInfo';
import { composeMedications } from './sections/visit-note/medicationsInfo';
import { composeProcedures, createProceduresSection } from './sections/visit-note/procedures';
import { composeVisitData, createVisitInfoSection } from './sections/visitInfo';
import { fetchServiceCategoryCatalog } from './service-category-catalog';
import { DischargeSummaryData, DischargeSummaryInput, PdfResult } from './types';

const composeDischargeSummaryData: DataComposer<DischargeSummaryInput, DischargeSummaryData> = (input) => {
  const { allChartData, appointmentPackage, upcomingFollowUps } = input;
  const { appointment, location, timezone } = appointmentPackage;
  const visit = composeVisitData({ appointment, location, timezone, serviceCategories: input.serviceCategories });
  const workSchoolExcuse = composeWorkSchoolExcuseSection({ allChartData });
  return {
    patient: composePatientInformationForDischargeSummary({ appointmentPackage }),
    visit,
    vitals: composeVitalsForDischargeSummary({ allChartData }),
    medications: composeMedications({ allChartData }),
    allergies: composeAllergies({ allChartData }),
    inHouseLabs: composeInHouseLabs({ allChartData }),
    externalLabs: composeExternalLabs({ allChartData }),
    radiology: composeRadiology({ allChartData }),
    inHouseMedications: composeInHouseMedicationsForDischargeSummary({ allChartData, appointmentPackage }),
    erxMedications: composeErxMedications({ allChartData, appointmentPackage, erxPharmacies: input.erxPharmacies }),
    diagnoses: composeDiagnoses({ allChartData }),
    procedures: composeProcedures({ allChartData, appointmentPackage }),
    patientInstructions: composePatientInstructions({ allChartData }),
    educationDocuments: composeEducationalDocuments({ allChartData }),
    disposition: composeDisposition({ allChartData }),
    physician: composePhysician({ appointmentPackage }),
    workSchoolExcuse,
    upcomingVisits: composeUpcomingVisits({ upcomingFollowUps }),
    attachmentDocRefs: workSchoolExcuse.attachmentDocRefs,
  };
};

const dischargeSummaryRenderConfig: PdfRenderConfig<DischargeSummaryData> = {
  header: {
    title: 'DISCHARGE SUMMARY',
    leftSection: createCompactPatientHeader(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: clinicalDocumentAssetPaths,
  styleFactory: createClinicalDocumentStyles,
  sections: [
    createReasonForVisitSection(),
    createMedicationsSectionForDischargeSummary(),
    createAllergiesSectionForDischargeSummary(),
    createVitalsSectionForDischargeSummary(),
    createInHouseLabsSection(),
    createExternalLabsSection(),
    createRadiologySection(),
    createInHouseMedicationsSectionForDischargeSummary(),
    createErxMedicationsSection(),
    createDiagnosesSection(),
    createProceduresSection(),
    createPatientInstructionsSection(),
    createEducationalDocumentsSection(),
    createDispositionSection(),
    createWorkSchoolExcuseSection(),
    createUpcomingVisitsSection(),
    createPhysicianSection(),
  ],
};

export const createDischargeSummaryPdf = async (
  input: DischargeSummaryInput,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  const serviceCategories = await fetchServiceCategoryCatalog(createClinicalOystehrClient(token, secrets));
  return generatePdf(
    { ...input, serviceCategories },
    composeDischargeSummaryData,
    dischargeSummaryRenderConfig,
    {
      patientId: input.appointmentPackage.patient!.id!,
      fileName: 'DischargeSummary.pdf',
      bucketName: BUCKET_NAMES.DISCHARGE_SUMMARIES,
    },
    secrets,
    token
  );
};
