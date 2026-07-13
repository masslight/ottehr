import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, DocumentReference, Location, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  FHIR_IDENTIFIER_NPI,
  formatDOB,
  genderMap,
  getFullestAvailableName,
  getPatientFriendlyId,
  getPresignedURL,
  LATERALITY_SELECTORS,
  LateralityValue,
  RADIOLOGY_SAFETY_FLAG_LABELS,
  RadiologySafetyFlag,
  Secrets,
  standardizePhoneNumber,
} from 'utils';
import { getPatientLastFirstName } from '../patients';
import { makeRadiologyDTO } from '../radiology';
import { drawFieldLine } from './helpers/render';
import { DataComposer, generatePdf, PdfRenderConfig, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import { composeVisitData, createPatientHeaderForDischargeSummary, createVisitInfoSection } from './sections';
import {
  AssetPaths,
  PatientInfoForDischargeSummary,
  PdfData,
  PdfSection,
  ServiceCategoryCatalogEntry,
  VisitInfo,
} from './types';

export const RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE = {
  system: 'http://ottehr.org/fhir/StructureDefinition/radiology-order-form',
  code: 'radiology-order-form',
  display: 'Radiology Order Form',
};

interface OrganizationBlock {
  name?: string;
  address?: string;
  phone?: string;
  fax?: string;
}

/** Resources the zambda fetches; the composer maps them to render data (no presentation logic in the zambda). */
export interface RadiologyOrderFormInput {
  serviceRequest: ServiceRequest;
  patient: Patient;
  practitioner?: Practitioner;
  appointment?: Appointment;
  location?: Location;
  timezone: string;
  serviceCategories: ServiceCategoryCatalogEntry[];
  weight?: { value: number; unit: string };
  oystehr: Oystehr;
}

// Render data is semantic (codes, structured values) — all display formatting happens in the section renderers.
interface RadiologyOrderFormData extends PdfData {
  patient: PatientInfoForDischargeSummary;
  visit: VisitInfo;
  performingOrg: OrganizationBlock;
  orderingClinic: OrganizationBlock;
  orderingProvider: { name: string; npi?: string };
  order: {
    studyType: string;
    diagnoses: { code: string; display: string }[];
    studyName?: string;
    laterality?: LateralityValue;
    timeWindow?: string;
    safetyFlags: RadiologySafetyFlag[];
    weight?: { value: number; unit: string };
    clinicalHistory?: string;
  };
}

const composeRadiologyOrderFormData: DataComposer<RadiologyOrderFormInput, RadiologyOrderFormData> = (input) => {
  const { serviceRequest, patient, practitioner, appointment, location, timezone, serviceCategories, weight, oystehr } =
    input;
  const dto = makeRadiologyDTO(serviceRequest);

  return {
    patient: {
      fullName: getPatientLastFirstName(patient) ?? '',
      dob: formatDOB(patient.birthDate) ?? '',
      sex: genderMap[patient.gender as keyof typeof genderMap] ?? '',
      id: getPatientFriendlyId(patient) || patient.id || '',
      phone: standardizePhoneNumber(patient.telecom?.find((t) => t.system === 'phone')?.value),
    },
    visit: appointment
      ? composeVisitData({ appointment, location, timezone, serviceCategories })
      : { type: '', time: '', date: '' },
    performingOrg: {
      name: dto.performingOrganization?.name,
      address: dto.performingOrganization?.address,
      phone: dto.performingOrganization?.phone,
      fax: dto.performingOrganization?.fax,
    },
    orderingClinic: {
      name: location?.name,
      address: location?.address ? oystehr.fhir.formatAddress(location.address) : undefined,
      phone: location?.telecom?.find((t) => t.system === 'phone')?.value,
      fax: location?.telecom?.find((t) => t.system === 'fax')?.value,
    },
    orderingProvider: {
      name: practitioner ? getFullestAvailableName(practitioner) ?? '' : '',
      npi: practitioner?.identifier?.find((id) => id.system === FHIR_IDENTIFIER_NPI)?.value,
    },
    order: {
      studyType: dto.studyType,
      diagnoses: dto.diagnoses ?? [],
      studyName: dto.studyName,
      laterality: dto.laterality,
      timeWindow: dto.timeWindow,
      safetyFlags: dto.safetyFlags ?? [],
      weight,
      clinicalHistory: dto.clinicalHistory,
    },
  };
};

const radiologyOrderFormAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Bold.otf',
  },
  icons: {
    call: './assets/call.png',
  },
};

const createRadiologyOrderFormStyles: StyleFactory = (assets) => ({
  textStyles: {
    header: { fontSize: 18, font: assets.fonts.bold, side: 'right', spacing: 5, newLineAfter: true },
    subHeader: {
      fontSize: 16,
      font: assets.fonts.bold,
      spacing: 5,
      newLineAfter: true,
    },
    columnHeader: { fontSize: 13, font: assets.fonts.bold, spacing: 5, newLineAfter: true },
    orgName: { fontSize: 14, font: assets.fonts.regular, spacing: 3, newLineAfter: true },
    patientName: { fontSize: 16, font: assets.fonts.bold, spacing: 5, newLineAfter: true },
    regular: { fontSize: 11, font: assets.fonts.regular, spacing: 2, newLineAfter: true },
    regularText: { fontSize: 11, font: assets.fonts.regular, spacing: 2, newLineAfter: true },
    text: { fontSize: 11, font: assets.fonts.regular, spacing: 2 },
    bold: { fontSize: 11, font: assets.fonts.bold, spacing: 2, newLineAfter: true },
    muted: {
      fontSize: 11,
      font: assets.fonts.regular,
      color: rgbNormalized(102, 102, 102),
      spacing: 2,
      newLineAfter: true,
    },
    alternativeRegularText: {
      fontSize: 11,
      font: assets.fonts.regular,
      color: rgbNormalized(143, 154, 167),
      spacing: 2,
      newLineAfter: true,
    },
    fieldHeader: { fontSize: 11, font: assets.fonts.bold, spacing: 1 },
    fieldText: { fontSize: 11, font: assets.fonts.regular, spacing: 2, newLineAfter: true },
  },
  lineStyles: {
    separator: { thickness: 1, color: rgbNormalized(227, 230, 239), margin: { top: 8, bottom: 8 } },
  },
});

const drawOrganizationBlock = (
  client: Parameters<PdfSection<RadiologyOrderFormData, unknown>['render']>[0],
  styles: Parameters<PdfSection<RadiologyOrderFormData, unknown>['render']>[2],
  heading: string,
  org: OrganizationBlock,
  extraLine?: string
): void => {
  client.drawText(heading, styles.textStyles.columnHeader);
  client.drawText(org.name || '—', styles.textStyles.orgName);
  if (org.address) client.drawText(org.address, styles.textStyles.regular);
  if (org.fax) client.drawText(`Fax: ${org.fax}`, styles.textStyles.regular);
  if (org.phone) client.drawText(`Phone: ${org.phone}`, styles.textStyles.regular);
  if (extraLine) client.drawText(extraLine, styles.textStyles.regular);
};

const performingOrgColumn: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData['performingOrg']> = {
  preferredWidth: 'column',
  dataSelector: (data) => data.performingOrg,
  render: (client, org, styles) => drawOrganizationBlock(client, styles, 'To:', org),
};

const orderingClinicColumn: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData> = {
  preferredWidth: 'column',
  dataSelector: (data) => data,
  render: (client, data, styles) => {
    const { orderingProvider: provider } = data;
    const providerLine = provider.name
      ? `Ordering Provider: ${provider.name}${provider.npi ? `, ${provider.npi}` : ''}`
      : undefined;
    drawOrganizationBlock(client, styles, 'From:', data.orderingClinic, providerLine);
  },
};

const orderDetailsSection: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData['order']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.order,
  render: (client, order, styles) => {
    client.drawSeparatedLine(styles.lineStyles.separator);
    client.drawText(`Radiology: ${order.studyType}`, styles.textStyles.subHeader);

    if (order.diagnoses.length) {
      drawFieldLine(client, styles, {
        label: 'DX',
        value: order.diagnoses.map((d) => `${d.code} - ${d.display}`).join('; '),
      });
    }
    if (order.studyName) {
      drawFieldLine(client, styles, { label: 'Study Name', value: order.studyName });
    }
    drawFieldLine(client, styles, { label: 'Study Type', value: order.studyType });
    if (order.laterality) {
      drawFieldLine(client, styles, {
        label: 'Laterality',
        value: `${order.laterality} (${LATERALITY_SELECTORS[order.laterality].uiDisplay})`,
      });
    }
    if (order.timeWindow) {
      drawFieldLine(client, styles, { label: 'Time frame', value: order.timeWindow });
    }
    if (order.safetyFlags.length) {
      drawFieldLine(client, styles, {
        label: 'Patient has',
        value: order.safetyFlags.map((flag) => RADIOLOGY_SAFETY_FLAG_LABELS[flag]).join(', '),
      });
    }
    if (order.weight) {
      drawFieldLine(client, styles, { label: 'Weight', value: `${order.weight.value} ${order.weight.unit}` });
    }
    if (order.clinicalHistory) {
      drawFieldLine(client, styles, { label: 'Clinical History', value: order.clinicalHistory });
    }
  },
};

const radiologyOrderFormRenderConfig: PdfRenderConfig<RadiologyOrderFormData> = {
  header: {
    title: 'RADIOLOGY ORDER',
    leftSection: createPatientHeaderForDischargeSummary(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: radiologyOrderFormAssetPaths,
  styleFactory: createRadiologyOrderFormStyles,
  sections: [performingOrgColumn, orderingClinicColumn, orderDetailsSection],
};

/**
 * Generates the radiology order-form PDF (via the shared pdf-common engine), uploads it to Z3, links
 * it to the order through a DocumentReference (context.related → ServiceRequest), and returns a
 * presigned URL to print. Regenerated on every call so it always reflects the current order state.
 */
export async function createRadiologyOrderFormPDF(
  input: RadiologyOrderFormInput,
  refs: { patientId: string; encounterId: string; serviceRequestId: string },
  secrets: Secrets | null,
  token: string
): Promise<{ documentReference: DocumentReference; presignedURL: string }> {
  const { patientId, encounterId, serviceRequestId } = refs;

  const { pdfInfo } = await generatePdf(
    input,
    composeRadiologyOrderFormData,
    radiologyOrderFormRenderConfig,
    { patientId, fileName: 'RadiologyOrderForm.pdf', bucketName: BUCKET_NAMES.VISIT_NOTES },
    secrets,
    token
  );

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: pdfInfo.uploadURL, title: pdfInfo.title }],
    type: { coding: [RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE], text: RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.display },
    references: {
      subject: { reference: `Patient/${patientId}` },
      context: {
        related: [{ reference: `ServiceRequest/${serviceRequestId}` }],
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr: input.oystehr,
    // Supersede prior order-form PDFs for THIS order so reprints don't pile up stale copies.
    searchParams: [{ name: 'related', value: `ServiceRequest/${serviceRequestId}` }],
    generateUUID: randomUUID,
    listResources: [],
  });

  if (!docRefs.length) {
    throw new Error('Unable to make DocumentReference for radiology order form');
  }

  const presignedURL = await getPresignedURL(pdfInfo.uploadURL, token);
  if (!presignedURL) {
    throw new Error('Failed to get presigned URL for radiology order form PDF');
  }

  return { documentReference: docRefs[0], presignedURL };
}
