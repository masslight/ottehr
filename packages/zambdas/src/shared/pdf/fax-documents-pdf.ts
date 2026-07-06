import { DataComposer, PdfRenderConfig, renderPdf, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import {
  composePatientInformationForDischargeSummary,
  composePatientInstructions,
  composePrescriptions,
  composeRadiology,
  composeVisitData,
  createPatientHeaderForDischargeSummary,
  createPatientInstructionsSection,
  createPrescriptionsSection,
  createRadiologySection,
  createVisitInfoSection,
} from './sections';
import {
  AssetPaths,
  PatientInfoForDischargeSummary,
  PatientInstructionsData,
  PdfClient,
  PdfData,
  PdfSection,
  PdfStyles,
  Prescriptions,
  RadiologyData,
  VisitInfo,
} from './types';
import { AllChartData, FullAppointmentResourcePackage } from './visit-details-pdf/types';

export const FAX_CONFIDENTIALITY_NOTICE =
  'This fax contains confidential medical information intended only for the named recipient. ' +
  'If received in error, please notify us immediately and destroy all copies.';

const faxAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Medium.ttf',
  },
  icons: {
    call: './assets/call.png',
  },
};

const createFaxStyles: StyleFactory = (assets) => ({
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
    text: {
      fontSize: 12,
      font: assets.fonts.regular,
      spacing: 2,
      newLineAfter: true,
    },
    muted: {
      fontSize: 12,
      font: assets.fonts.regular,
      color: rgbNormalized(102, 102, 102),
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

// --- Standalone visit documents (rendered on demand for faxing) ---

export interface FaxStandaloneDocInput {
  allChartData: AllChartData;
  appointmentPackage: FullAppointmentResourcePackage;
}

interface FaxDocBaseData extends PdfData {
  patient: PatientInfoForDischargeSummary;
  visit: VisitInfo;
}

const composeFaxDocBaseData = ({ appointmentPackage }: FaxStandaloneDocInput): FaxDocBaseData => {
  const { appointment, location, timezone } = appointmentPackage;
  return {
    patient: composePatientInformationForDischargeSummary({ appointmentPackage }),
    visit: composeVisitData({ appointment, location, timezone }),
  };
};

const makeStandaloneDocRenderConfig = <TData extends FaxDocBaseData>(
  title: string,
  section: PdfSection<TData, any>
): PdfRenderConfig<TData> => ({
  header: {
    title,
    leftSection: createPatientHeaderForDischargeSummary(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: faxAssetPaths,
  styleFactory: createFaxStyles,
  sections: [section],
});

interface FaxPrescriptionsData extends FaxDocBaseData {
  prescriptions: Prescriptions;
}

const composeFaxPrescriptionsData: DataComposer<FaxStandaloneDocInput, FaxPrescriptionsData> = (input) => ({
  ...composeFaxDocBaseData(input),
  prescriptions: composePrescriptions({ allChartData: input.allChartData }),
});

export const hasPrescriptionsContent = (allChartData: AllChartData): boolean =>
  !!composePrescriptions({ allChartData }).prescriptions?.length;

export const createPrescriptionsPdfBytes = async (input: FaxStandaloneDocInput, token: string): Promise<Uint8Array> =>
  renderPdf(
    composeFaxPrescriptionsData(input),
    makeStandaloneDocRenderConfig('PRESCRIPTIONS', createPrescriptionsSection<FaxPrescriptionsData>()),
    token
  );

interface FaxPatientInstructionsData extends FaxDocBaseData {
  patientInstructions: PatientInstructionsData;
}

const composeFaxPatientInstructionsData: DataComposer<FaxStandaloneDocInput, FaxPatientInstructionsData> = (input) => ({
  ...composeFaxDocBaseData(input),
  patientInstructions: composePatientInstructions({ allChartData: input.allChartData }),
});

export const hasPatientInstructionsContent = (allChartData: AllChartData): boolean =>
  !!composePatientInstructions({ allChartData }).instructions?.length;

export const createPatientInstructionsPdfBytes = async (
  input: FaxStandaloneDocInput,
  token: string
): Promise<Uint8Array> =>
  renderPdf(
    composeFaxPatientInstructionsData(input),
    makeStandaloneDocRenderConfig(
      'PATIENT INSTRUCTIONS',
      createPatientInstructionsSection<FaxPatientInstructionsData>()
    ),
    token
  );

interface FaxRadiologyData extends FaxDocBaseData {
  radiology: RadiologyData;
}

const composeFaxRadiologyData: DataComposer<FaxStandaloneDocInput, FaxRadiologyData> = (input) => ({
  ...composeFaxDocBaseData(input),
  radiology: composeRadiology({ allChartData: input.allChartData }),
});

export const hasRadiologyResultsContent = (allChartData: AllChartData): boolean =>
  !!composeRadiology({ allChartData }).radiology?.length;

export const createRadiologyResultsPdfBytes = async (
  input: FaxStandaloneDocInput,
  token: string
): Promise<Uint8Array> =>
  renderPdf(
    composeFaxRadiologyData(input),
    makeStandaloneDocRenderConfig('RADIOLOGY RESULTS', createRadiologySection<FaxRadiologyData>()),
    token
  );

// --- Fax cover page ---

export interface FaxCoverPageData extends PdfData {
  sender: {
    facilityName: string;
    addressLines: string[];
    phone?: string;
    fax?: string;
    /** Formatted date and time the fax is being transmitted. */
    transmissionDateTime: string;
    /** Name and title of the provider/staff member sending the fax. */
    sentBy: string;
  };
  recipient: {
    name?: string;
    organization?: string;
    faxNumber: string;
    phoneNumber?: string;
  };
  patient: {
    fullName: string;
    dob: string;
  };
  /** e.g. "Re: Urgent Care Encounter, 07/02/2026" */
  reLine: string;
  /** Total page count of the transmission, including this cover page. */
  totalPages: number;
}

const coverPageSection = (
  title: string | undefined,
  render: (client: PdfClient, data: FaxCoverPageData, styles: PdfStyles) => void
): PdfSection<FaxCoverPageData, FaxCoverPageData> => ({
  title,
  dataSelector: (data) => data,
  render: (client, data, styles) => {
    render(client, data, styles);
    client.drawSeparatedLine(styles.lineStyles.separator);
  },
});

const faxCoverPageRenderConfig: PdfRenderConfig<FaxCoverPageData> = {
  header: {
    title: 'FAX COVER PAGE',
  },
  headerBodySeparator: true,
  assetPaths: faxAssetPaths,
  styleFactory: createFaxStyles,
  sections: [
    coverPageSection('From', (client, data, styles) => {
      client.drawText(data.sender.facilityName, styles.textStyles.bold);
      data.sender.addressLines.forEach((line) => client.drawText(line, styles.textStyles.regular));
      if (data.sender.phone) client.drawText(`Phone: ${data.sender.phone}`, styles.textStyles.regular);
      if (data.sender.fax) client.drawText(`Fax: ${data.sender.fax}`, styles.textStyles.regular);
      client.drawText(`Date of transmission: ${data.sender.transmissionDateTime}`, styles.textStyles.regular);
    }),
    coverPageSection('To', (client, data, styles) => {
      if (data.recipient.name) client.drawText(data.recipient.name, styles.textStyles.bold);
      if (data.recipient.organization) client.drawText(data.recipient.organization, styles.textStyles.regular);
      client.drawText(`Fax: ${data.recipient.faxNumber}`, styles.textStyles.regular);
      if (data.recipient.phoneNumber) {
        client.drawText(`Phone (for follow-up): ${data.recipient.phoneNumber}`, styles.textStyles.regular);
      }
    }),
    coverPageSection(undefined, (client, data, styles) => {
      client.drawText(data.reLine, styles.textStyles.bold);
    }),
    coverPageSection('Patient', (client, data, styles) => {
      client.drawText(data.patient.fullName, styles.textStyles.regular);
      client.drawText(`DOB: ${data.patient.dob}`, styles.textStyles.regular);
    }),
    coverPageSection('Transmission Details', (client, data, styles) => {
      client.drawText(`Total pages (including cover page): ${data.totalPages}`, styles.textStyles.regular);
      client.drawText(`Sent by: ${data.sender.sentBy}`, styles.textStyles.regular);
    }),
    coverPageSection('Confidentiality Notice', (client, _data, styles) => {
      client.drawText(FAX_CONFIDENTIALITY_NOTICE, styles.textStyles.muted);
    }),
  ],
};

export const createFaxCoverPagePdfBytes = async (data: FaxCoverPageData, token: string): Promise<Uint8Array> =>
  renderPdf(data, faxCoverPageRenderConfig, token);
