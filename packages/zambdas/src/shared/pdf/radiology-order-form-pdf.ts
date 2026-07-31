import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, Location, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BRANDING_CONFIG,
  BUCKET_NAMES,
  createFilesDocumentReferences,
  FHIR_IDENTIFIER_NPI,
  formatDateForLabs,
  formatDOB,
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
import { calculateAge, rgbNormalized } from './pdf-utils';
import { AssetPaths, PdfData, PdfSection } from './types';

export const RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE = {
  system: 'http://ottehr.org/fhir/StructureDefinition/radiology-order-form',
  code: 'radiology-order-form',
  display: 'Radiology Order Form',
};

interface OrganizationBlock {
  projectName?: string;
  name?: string;
  address?: string;
  phone?: string;
  fax?: string;
}

export interface RadiologyOrderFormInput {
  serviceRequest: ServiceRequest;
  patient: Patient;
  practitioner?: Practitioner;
  location?: Location;
  timezone: string;
  weight?: { value: number; unit: string };
  oystehr: Oystehr;
}

interface RadiologyOrderFormData extends PdfData {
  patient: { name: string; dob: string; ageYears?: number; id: string; phone?: string };
  performingOrg: OrganizationBlock;
  orderingClinic: OrganizationBlock;
  orderingProvider: { name: string; npi?: string; signatureName: string };
  order: {
    orderedAtISO?: string;
    timezone: string;
    studyType: string;
    diagnoses: { code: string; display: string }[];
    laterality?: LateralityValue;
    clinicalHistory?: string;
    safetyFlags: RadiologySafetyFlag[];
    weight?: { value: number; unit: string };
    timeWindow?: string;
  };
}

const composeRadiologyOrderFormData: DataComposer<RadiologyOrderFormInput, RadiologyOrderFormData> = (input) => {
  const { serviceRequest, patient, practitioner, location, timezone, weight, oystehr } = input;
  const dto = makeRadiologyDTO(serviceRequest);

  const practitionerName = practitioner?.name?.[0];
  const signatureName = practitionerName
    ? [practitionerName.given?.join(' '), practitionerName.family].filter(Boolean).join(' ')
    : '';

  return {
    patient: {
      name: getPatientLastFirstName(patient) ?? '',
      dob: formatDOB(patient.birthDate) ?? '',
      ageYears: patient.birthDate ? calculateAge(patient.birthDate) : undefined,
      id: getPatientFriendlyId(patient) || patient.id || '',
      phone: standardizePhoneNumber(patient.telecom?.find((t) => t.system === 'phone')?.value),
    },
    performingOrg: {
      name: dto.performingOrganization?.name,
      address: dto.performingOrganization?.address,
      phone: dto.performingOrganization?.phone,
      fax: dto.performingOrganization?.fax,
    },
    orderingClinic: {
      projectName: BRANDING_CONFIG.projectName,
      name: location?.name,
      address: location?.address ? oystehr.fhir.formatAddress(location.address) : undefined,
      phone: location?.telecom?.find((t) => t.system === 'phone')?.value,
      fax: location?.telecom?.find((t) => t.system === 'fax')?.value,
    },
    orderingProvider: {
      name: practitioner ? getFullestAvailableName(practitioner) ?? '' : '',
      npi: practitioner?.identifier?.find((id) => id.system === FHIR_IDENTIFIER_NPI)?.value,
      signatureName,
    },
    order: {
      orderedAtISO: serviceRequest.authoredOn,
      timezone,
      studyType: dto.studyType,
      diagnoses: dto.diagnoses ?? [],
      laterality: dto.laterality,
      clinicalHistory: dto.clinicalHistory,
      safetyFlags: dto.safetyFlags ?? [],
      weight,
      timeWindow: dto.timeWindow,
    },
  };
};

const radiologyOrderFormAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Bold.otf',
    signature: './assets/DancingScript-Regular.otf',
  },
  icons: {
    warning: './assets/abnormal.png',
  },
};

const createRadiologyOrderFormStyles: StyleFactory = (assets) => {
  const bodyLine = { fontSize: 11, font: assets.fonts.regular, spacing: 2, newLineAfter: true };
  return {
    textStyles: {
      // `header` is the title style (rendered as a full-width banner)
      header: { fontSize: 16, font: assets.fonts.bold, spacing: 8, newLineAfter: true },
      subHeader: { fontSize: 14, font: assets.fonts.bold, spacing: 5, newLineAfter: true },
      sectionLabel: { fontSize: 12, font: assets.fonts.bold, spacing: 4, newLineAfter: true },
      orgName: { fontSize: 13, font: assets.fonts.bold, spacing: 3, newLineAfter: true },
      patientName: { fontSize: 13, font: assets.fonts.bold, spacing: 3, newLineAfter: true },
      studyHeading: { fontSize: 15, font: assets.fonts.bold, spacing: 6, newLineAfter: true },
      timeWindow: {
        fontSize: 12,
        font: assets.fonts.bold,
        color: rgbNormalized(211, 47, 47),
        spacing: 4,
        newLineAfter: true,
      },
      signature: { fontSize: 20, font: assets.fonts.signature, spacing: 5, newLineAfter: true },
      regular: bodyLine,
      fieldText: bodyLine,
      text: { fontSize: 11, font: assets.fonts.regular, spacing: 2 },
      fieldHeader: { fontSize: 11, font: assets.fonts.bold, spacing: 1 },
    },
    lineStyles: {
      separator: { thickness: 1, color: rgbNormalized(227, 230, 239), margin: { top: 8, bottom: 8 } },
    },
  };
};

const drawOrganizationBlock = (
  client: Parameters<PdfSection<RadiologyOrderFormData, unknown>['render']>[0],
  styles: Parameters<PdfSection<RadiologyOrderFormData, unknown>['render']>[2],
  label: string,
  org: OrganizationBlock
): void => {
  client.drawText(label, styles.textStyles.sectionLabel);
  const nameLines = [org.projectName, org.name].filter(Boolean) as string[];
  if (!nameLines.length) nameLines.push('—');
  nameLines.forEach((line) => client.drawText(line, styles.textStyles.orgName));
  if (org.address) client.drawText(org.address, styles.textStyles.regular);
  if (org.fax) client.drawText(`Fax: ${org.fax}`, styles.textStyles.regular);
  if (org.phone) client.drawText(`Phone: ${org.phone}`, styles.textStyles.regular);
};

const fromColumn: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData['orderingClinic']> = {
  preferredWidth: 'column',
  dataSelector: (data) => data.orderingClinic,
  render: (client, clinic, styles) => drawOrganizationBlock(client, styles, 'From:', clinic),
};

const toColumn: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData['performingOrg']> = {
  preferredWidth: 'column',
  dataSelector: (data) => data.performingOrg,
  render: (client, org, styles) => drawOrganizationBlock(client, styles, 'To:', org),
};

const patientSection: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData['patient']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.patient,
  render: (client, patient, styles) => {
    client.drawSeparatedLine(styles.lineStyles.separator);
    client.drawText('Patient:', styles.textStyles.sectionLabel);
    client.drawText(patient.name, styles.textStyles.patientName);
    const dobPart = patient.dob
      ? `DOB: ${patient.dob}${patient.ageYears != null ? ` (${patient.ageYears} yo)` : ''}`
      : '';
    const line = [dobPart, `PID: ${patient.id}`, patient.phone ? `Phone: ${patient.phone}` : '']
      .filter(Boolean)
      .join('     ');
    client.drawText(line, styles.textStyles.regular);
  },
};

const orderSection: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData> = {
  preferredWidth: 'full',
  dataSelector: (data) => data,
  render: (client, data, styles, assets) => {
    const { order, orderingProvider: provider } = data;
    client.drawSeparatedLine(styles.lineStyles.separator);

    const orderedAt = order.orderedAtISO ? formatDateForLabs(order.orderedAtISO, order.timezone) : '';
    const providerBit = provider.name ? ` by ${provider.name}${provider.npi ? `, NPI: ${provider.npi}` : ''}` : '';
    client.drawText(`Ordered ${orderedAt}${providerBit}`.trim(), styles.textStyles.regular);

    if (order.timeWindow) {
      client.drawText(order.timeWindow, styles.textStyles.timeWindow);
    }

    client.drawText(order.studyType, styles.textStyles.studyHeading);

    if (order.diagnoses.length) {
      drawFieldLine(client, styles, {
        label: 'DX:',
        value: order.diagnoses.map((d) => `${d.code} - ${d.display}`).join('; '),
      });
    }
    drawFieldLine(client, styles, { label: 'Study Type:', value: order.studyType });
    if (order.laterality) {
      drawFieldLine(client, styles, {
        label: 'Laterality:',
        value: `${order.laterality} (${LATERALITY_SELECTORS[order.laterality].uiDisplay})`,
      });
    }
    if (order.clinicalHistory) {
      drawFieldLine(client, styles, { label: 'Clinical History:', value: order.clinicalHistory });
    }
    if (order.safetyFlags.length) {
      drawFieldLine(client, styles, {
        icon: assets.icons?.warning,
        label: 'Patient has:',
        value: order.safetyFlags.map((flag) => RADIOLOGY_SAFETY_FLAG_LABELS[flag]).join(', '),
      });
    }
    if (order.weight) {
      drawFieldLine(client, styles, { label: 'Weight:', value: `${order.weight.value} ${order.weight.unit}` });
    }
  },
};

const signatureSection: PdfSection<RadiologyOrderFormData, RadiologyOrderFormData['orderingProvider']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.orderingProvider,
  shouldRender: (provider) => !!provider.signatureName,
  render: (client, provider, styles) => {
    client.newLine(48);
    client.drawText(provider.signatureName, styles.textStyles.signature);
  },
};

const radiologyOrderFormRenderConfig: PdfRenderConfig<RadiologyOrderFormData> = {
  // Title spans the full width, top-left (banner); From/To follow as left-aligned body columns.
  header: { title: 'RADIOLOGY ORDER', titleLayout: 'banner' },
  headerBodySeparator: false,
  assetPaths: radiologyOrderFormAssetPaths,
  styleFactory: createRadiologyOrderFormStyles,
  sections: [fromColumn, toColumn, patientSection, orderSection, signatureSection],
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
    // supersede prior order-form PDFs for this order; the type filter avoids touching result docRefs
    searchParams: [
      { name: 'related', value: `ServiceRequest/${serviceRequestId}` },
      {
        name: 'type',
        value: `${RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.system}|${RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.code}`,
      },
    ],
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
