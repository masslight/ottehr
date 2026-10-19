import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DeviceRequest, DocumentReference, Location, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { createFilesDocumentReferences, genderMap } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName, getPatientFriendlyId } from 'utils/lib/fhir/patient';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { BRANDING_CONFIG } from 'utils/lib/ottehr-config/branding';
import { Secrets } from 'utils/lib/secrets';
import {
  DME_LATERALITY_LABELS,
  DME_MODIFIER_LABELS,
  DmeOrderDTO,
  DmeOrderStatus,
  formatDmeBillingCode,
  formatDmeDuration,
} from 'utils/lib/types/api/dme.types';
import { formatDateForLabs, formatDOB } from 'utils/lib/utils/dateUtils';
import { parseDmeOrder } from '../dme';
import { getPatientLastFirstName } from '../patients';
import { drawFieldLine } from './helpers/render/drawFieldLine';
import { DataComposer, PdfRenderConfig, renderPdf, StyleFactory, uploadPdfToStorage } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import { AssetPaths, PdfClient, PdfData, PdfSection, PdfStyles } from './types';

export const DME_ORDER_FORM_DOC_REF_DOCTYPE = {
  system: 'http://ottehr.org/fhir/StructureDefinition/dme-order-form',
  code: 'dme-order-form',
  display: 'DME Order Form',
};

export const DME_ORDER_FORM_SOURCE_VERSION_SYSTEM =
  'http://ottehr.org/fhir/StructureDefinition/dme-order-form-source-version';

const SIGNATURE_BLANK = '______________________________';

interface OrganizationBlock {
  projectName?: string;
  name?: string;
  address?: string;
  phone?: string;
  fax?: string;
}

export interface DmeOrderFormInput {
  deviceRequest: DeviceRequest;
  patient: Patient;
  /** the ordering and dispensing practitioners */
  practitioners: Practitioner[];
  location?: Location;
  timezone: string;
  oystehr: Oystehr;
}

export interface DmeOrderFormData extends PdfData {
  orderingClinic: OrganizationBlock;
  thirdParty?: OrganizationBlock;
  patient: { name: string; dob: string; sex?: string; id: string; phone?: string; address?: string };
  order: {
    orderedAt: string;
    itemName: string;
    billingCodes: string[];
    diagnoses: string[];
    quantity: string;
    laterality?: string;
    modifier?: string;
    duration?: string;
    instructions?: string;
    fulfillment: string;
    dispensed?: string;
  };
  orderingProvider: { name: string; npi?: string; signatureName: string };
  inHouse: boolean;
}

const dmeFulfillmentText = (order: DmeOrderDTO): string => {
  if (order.external) return 'Fulfilled by external site / third party';
  return order.status === DmeOrderStatus.dispensed
    ? 'Dispensed from in-house inventory'
    : 'To be dispensed from in-house inventory';
};

export const composeDmeOrderFormData: DataComposer<DmeOrderFormInput, DmeOrderFormData> = (input) => {
  const { deviceRequest, patient, practitioners, location, timezone, oystehr } = input;
  const practitionerNames = Object.fromEntries(
    practitioners.flatMap((practitioner) =>
      practitioner.id ? [[practitioner.id, getFullestAvailableName(practitioner) ?? '']] : []
    )
  );
  const order = parseDmeOrder(deviceRequest, practitionerNames);

  const orderingPractitioner = practitioners.find((p) => p.id === order.orderedBy.practitionerId);
  const practitionerName = orderingPractitioner?.name?.[0];
  const signatureName = practitionerName
    ? [practitionerName.given?.join(' '), practitionerName.family].filter(Boolean).join(' ')
    : '';

  const dispensedAt = order.dispensed ? formatDateForLabs(order.dispensed.at, timezone) : '';

  return {
    orderingClinic: {
      projectName: BRANDING_CONFIG.projectName,
      name: location?.name,
      address: location?.address ? oystehr.fhir.formatAddress(location.address) : undefined,
      phone: location?.telecom?.find((t) => t.system === 'phone')?.value,
      fax: location?.telecom?.find((t) => t.system === 'fax')?.value,
    },
    thirdParty: order.external ? { ...order.thirdParty } : undefined,
    patient: {
      name: getPatientLastFirstName(patient) ?? '',
      dob: formatDOB(patient.birthDate) ?? '',
      sex: genderMap[patient.gender as keyof typeof genderMap],
      id: getPatientFriendlyId(patient) || patient.id || '',
      phone: standardizePhoneNumber(patient.telecom?.find((t) => t.system === 'phone')?.value),
      address: patient.address?.[0] ? oystehr.fhir.formatAddress(patient.address[0]) : undefined,
    },
    order: {
      orderedAt: formatDateForLabs(order.orderedAt, timezone),
      itemName: order.itemName,
      billingCodes: order.billingCodes.map(formatDmeBillingCode),
      diagnoses: order.diagnoses.map((dx) => `${dx.code} - ${dx.display}`),
      quantity: String(order.quantity),
      laterality: order.laterality ? DME_LATERALITY_LABELS[order.laterality] : undefined,
      modifier: order.modifier ? DME_MODIFIER_LABELS[order.modifier] : undefined,
      duration: formatDmeDuration(order.duration),
      instructions: order.instructions,
      fulfillment: dmeFulfillmentText(order),
      dispensed: order.dispensed
        ? [dispensedAt, order.dispensed.name && `by ${order.dispensed.name}`].filter(Boolean).join(' ')
        : undefined,
    },
    orderingProvider: {
      name: order.orderedBy.name,
      npi: orderingPractitioner?.identifier?.find((id) => id.system === FHIR_IDENTIFIER_NPI)?.value,
      signatureName,
    },
    inHouse: !order.external,
  };
};

const dmeOrderFormAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Bold.otf',
    signature: './assets/DancingScript-Regular.otf',
  },
};

const createDmeOrderFormStyles: StyleFactory = (assets) => {
  const bodyLine = { fontSize: 11, font: assets.fonts.regular, spacing: 2, newLineAfter: true };
  return {
    textStyles: {
      header: { fontSize: 16, font: assets.fonts.bold, spacing: 8, newLineAfter: true },
      subHeader: { fontSize: 14, font: assets.fonts.bold, spacing: 5, newLineAfter: true },
      sectionLabel: { fontSize: 12, font: assets.fonts.bold, spacing: 4, newLineAfter: true },
      orgName: { fontSize: 13, font: assets.fonts.bold, spacing: 3, newLineAfter: true },
      patientName: { fontSize: 13, font: assets.fonts.bold, spacing: 3, newLineAfter: true },
      itemHeading: { fontSize: 15, font: assets.fonts.bold, spacing: 6, newLineAfter: true },
      signature: { fontSize: 20, font: assets.fonts.signature, spacing: 5, newLineAfter: true },
      regular: bodyLine,
      fieldText: bodyLine,
      caption: { fontSize: 9, font: assets.fonts.regular, spacing: 2, newLineAfter: true },
      fieldHeader: { fontSize: 11, font: assets.fonts.bold, spacing: 1 },
    },
    lineStyles: {
      separator: { thickness: 1, color: rgbNormalized(227, 230, 239), margin: { top: 8, bottom: 8 } },
    },
  };
};

const drawOrganizationBlock = (client: PdfClient, styles: PdfStyles, label: string, org: OrganizationBlock): void => {
  client.drawText(label, styles.textStyles.sectionLabel);
  const nameLines = [org.projectName, org.name].filter(Boolean) as string[];
  if (!nameLines.length) nameLines.push('—');
  nameLines.forEach((line) => client.drawText(line, styles.textStyles.orgName));
  if (org.address) client.drawText(org.address, styles.textStyles.regular);
  if (org.fax) client.drawText(`Fax: ${org.fax}`, styles.textStyles.regular);
  if (org.phone) client.drawText(`Phone: ${org.phone}`, styles.textStyles.regular);
};

const fromColumn: PdfSection<DmeOrderFormData, OrganizationBlock> = {
  preferredWidth: 'column',
  dataSelector: (data) => data.orderingClinic,
  render: (client, clinic, styles) => drawOrganizationBlock(client, styles, 'From:', clinic),
};

const toColumn: PdfSection<DmeOrderFormData, OrganizationBlock> = {
  preferredWidth: 'column',
  dataSelector: (data) => data.thirdParty,
  render: (client, thirdParty, styles) => drawOrganizationBlock(client, styles, 'To:', thirdParty),
};

const patientSection: PdfSection<DmeOrderFormData, DmeOrderFormData['patient']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.patient,
  render: (client, patient, styles) => {
    client.drawSeparatedLine(styles.lineStyles.separator);
    client.drawText('Patient:', styles.textStyles.sectionLabel);
    client.drawText(patient.name, styles.textStyles.patientName);
    const line = [
      patient.dob && `DOB: ${patient.dob}`,
      patient.sex && `Sex: ${patient.sex}`,
      `PID: ${patient.id}`,
      patient.phone && `Phone: ${patient.phone}`,
    ]
      .filter(Boolean)
      .join('     ');
    client.drawText(line, styles.textStyles.regular);
    if (patient.address) client.drawText(patient.address, styles.textStyles.regular);
  },
};

const orderSection: PdfSection<DmeOrderFormData, DmeOrderFormData['order']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.order,
  render: (client, order, styles) => {
    client.drawSeparatedLine(styles.lineStyles.separator);
    if (order.orderedAt) client.drawText(`Order Date: ${order.orderedAt}`, styles.textStyles.regular);
    client.drawText(order.itemName, styles.textStyles.itemHeading);

    const fields: [string, string | undefined][] = [
      ['DME Item:', order.itemName],
      ['HCPCS/CPT:', order.billingCodes.join('; ') || undefined],
      ['Dx:', order.diagnoses.join('; ') || undefined],
      ['Quantity:', order.quantity],
      ['Laterality:', order.laterality],
      ['Modifier:', order.modifier],
      ['Estimated Duration of Use:', order.duration],
      ['Patient Instructions:', order.instructions],
      ['Fulfillment:', order.fulfillment],
      ['Dispensed:', order.dispensed],
    ];
    fields.forEach(([label, value]) => {
      if (value) drawFieldLine(client, styles, { label, value });
    });
  },
};

const providerSignatureSection: PdfSection<DmeOrderFormData, DmeOrderFormData['orderingProvider']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.orderingProvider,
  render: (client, provider, styles) => {
    client.drawSeparatedLine(styles.lineStyles.separator);
    client.drawText('Ordering Provider:', styles.textStyles.sectionLabel);
    if (provider.name) {
      client.drawText(`${provider.name}${provider.npi ? `, NPI: ${provider.npi}` : ''}`, styles.textStyles.regular);
    }
    client.newLine(24);
    if (provider.signatureName) client.drawText(provider.signatureName, styles.textStyles.signature);
    client.drawText(SIGNATURE_BLANK, styles.textStyles.regular);
    client.drawText('Provider Signature', styles.textStyles.caption);
  },
};

const proofOfDeliverySection: PdfSection<DmeOrderFormData, DmeOrderFormData> = {
  preferredWidth: 'full',
  dataSelector: (data) => data,
  shouldRender: (data) => data.inHouse,
  render: (client, _data, styles) => {
    client.drawSeparatedLine(styles.lineStyles.separator);
    client.drawText('Proof of Delivery:', styles.textStyles.sectionLabel);
    client.drawText('I acknowledge that I have received the item(s) listed above.', styles.textStyles.regular);
    client.newLine(24);
    drawFieldLine(client, styles, { label: 'Patient / Guardian Signature:', value: SIGNATURE_BLANK });
    client.newLine(12);
    drawFieldLine(client, styles, { label: 'Date:', value: SIGNATURE_BLANK });
  },
};

const dmeOrderFormRenderConfig: PdfRenderConfig<DmeOrderFormData> = {
  header: { title: 'Durable Medical Equipment (DME) Order', titleLayout: 'banner' },
  headerBodySeparator: false,
  assetPaths: dmeOrderFormAssetPaths,
  styleFactory: createDmeOrderFormStyles,
  sections: [fromColumn, toColumn, patientSection, orderSection, providerSignatureSection, proofOfDeliverySection],
};

export const createDmeOrderFormPdfBytes = async (input: DmeOrderFormInput, token: string): Promise<Uint8Array> =>
  renderPdf(composeDmeOrderFormData(input), dmeOrderFormRenderConfig, token);

/** Renders the DME order form, uploads it to Z3 and files it on the visit, superseding earlier copies. */
export async function createDmeOrderFormPDF(
  input: DmeOrderFormInput,
  refs: { patientId: string; encounterId: string; deviceRequestId: string },
  secrets: Secrets | null,
  token: string,
  sourceVersion?: string
): Promise<{ documentReference: DocumentReference; presignedURL: string }> {
  const { patientId, encounterId, deviceRequestId } = refs;

  const pdfInfo = await uploadPdfToStorage(
    await createDmeOrderFormPdfBytes(input, token),
    { patientId, fileName: 'DmeOrderForm.pdf', bucketName: BUCKET_NAMES.VISIT_NOTES },
    secrets,
    token
  );

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: pdfInfo.uploadURL, title: pdfInfo.title }],
    type: { coding: [DME_ORDER_FORM_DOC_REF_DOCTYPE], text: DME_ORDER_FORM_DOC_REF_DOCTYPE.display },
    references: {
      subject: { reference: `Patient/${patientId}` },
      context: {
        related: [{ reference: `DeviceRequest/${deviceRequestId}` }],
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
      ...(sourceVersion
        ? { identifier: [{ system: DME_ORDER_FORM_SOURCE_VERSION_SYSTEM, value: sourceVersion }] }
        : {}),
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr: input.oystehr,
    searchParams: [
      { name: 'related', value: `DeviceRequest/${deviceRequestId}` },
      { name: 'type', value: `${DME_ORDER_FORM_DOC_REF_DOCTYPE.system}|${DME_ORDER_FORM_DOC_REF_DOCTYPE.code}` },
    ],
    generateUUID: randomUUID,
    listResources: [],
  });

  if (!docRefs.length) {
    throw new Error('Unable to make DocumentReference for DME order form');
  }

  const presignedURL = await getPresignedURL(pdfInfo.uploadURL, token);
  if (!presignedURL) {
    throw new Error('Failed to get presigned URL for DME order form PDF');
  }

  return { documentReference: docRefs[0], presignedURL };
}
