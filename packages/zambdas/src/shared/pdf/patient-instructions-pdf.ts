import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { createClinicalOystehrClient } from '../helpers';
import { clinicalDocumentAssetPaths, createClinicalDocumentStyles } from './clinical-document-theme';
import { DataComposer, generatePdf, PdfRenderConfig } from './pdf-common';
import {
  composePatientInformationForDischargeSummary,
  createCompactPatientHeader,
} from './sections/discharge-summary/patientInfo';
import {
  composePatientInstructions,
  createPatientInstructionsSection,
} from './sections/discharge-summary/patientInstructions';
import { composeVisitData, createVisitInfoSection } from './sections/visitInfo';
import { fetchServiceCategoryCatalog } from './service-category-catalog';
import { PatientInstructionsPdfData, PatientInstructionsPdfInput, PdfResult } from './types';

/**
 * The visit's patient instructions as a document of their own.
 *
 * The discharge summary already renders these as one of its sections and continues to do so — this
 * is the same content as a short take-home sheet, for handing to a patient who does not need the
 * full summary. Both go through `createPatientInstructionsSection`, so the wording a patient reads
 * here is by construction the wording in their summary.
 */
export const composePatientInstructionsPdfData: DataComposer<
  PatientInstructionsPdfInput,
  PatientInstructionsPdfData
> = (input) => {
  const { allChartData, appointmentPackage, serviceCategories } = input;
  const { appointment, location, timezone } = appointmentPackage;

  return {
    patient: composePatientInformationForDischargeSummary({ appointmentPackage }),
    visit: composeVisitData({ appointment, location, timezone, serviceCategories }),
    patientInstructions: composePatientInstructions({ allChartData }),
  };
};

const patientInstructionsRenderConfig: PdfRenderConfig<PatientInstructionsPdfData> = {
  header: {
    title: 'PATIENT INSTRUCTIONS',
    leftSection: createCompactPatientHeader(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: clinicalDocumentAssetPaths,
  styleFactory: createClinicalDocumentStyles,
  sections: [createPatientInstructionsSection()],
};

export const createPatientInstructionsPdf = async (
  input: PatientInstructionsPdfInput,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  const serviceCategories = await fetchServiceCategoryCatalog(createClinicalOystehrClient(token, secrets));

  return generatePdf(
    { ...input, serviceCategories },
    composePatientInstructionsPdfData,
    patientInstructionsRenderConfig,
    {
      patientId: input.appointmentPackage.patient!.id!,
      fileName: 'PatientInstructions.pdf',
      bucketName: BUCKET_NAMES.VISIT_NOTES,
      // Print-only, so no DocumentReference points at it. See make-progress-note-pdf: one reusable
      // slot per patient rather than an unreachable PDF left behind by every print.
      stableKey: true,
    },
    secrets,
    token
  );
};
