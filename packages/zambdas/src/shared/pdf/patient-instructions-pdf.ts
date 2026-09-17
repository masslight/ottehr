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
      // One slot per visit: nothing references these, so a unique key per print would leak storage.
      fileName: `PatientInstructions-${input.appointmentPackage.appointment.id}.pdf`,
      bucketName: BUCKET_NAMES.VISIT_NOTES,
      stableKey: true,
    },
    secrets,
    token
  );
};
