import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, Location, Organization, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { createFilesDocumentReferences, getAddressString, getOrganizationFaxNumber } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName, getPatientFriendlyId } from 'utils/lib/fhir/patient';
import {
  getReferralDetails,
  getReferralNotesToRecipient,
  getReferralReason,
  getReferralSpecialty,
  getReferralUrgency,
  REFERRAL_FORM_DOC_REF_DOCTYPE,
  REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/referral';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { Secrets } from 'utils/lib/secrets';
import { FAX_DOCUMENT_LABELS, HIPAA_FAX_CONFIDENTIALITY_STATEMENT } from 'utils/lib/types/api/fax.types';
import {
  REFERRAL_ASK_LABELS,
  REFERRAL_DEFAULTS,
  REFERRAL_RESPONSE_REQUEST_TEXT,
  REFERRAL_SCHEDULER_LABELS,
  REFERRAL_URGENCY_LABELS,
  ReferralRecipient,
} from 'utils/lib/types/api/referrals/referrals.types';
import { formatDateForLabs, formatDOB } from 'utils/lib/utils/dateUtils';
import { getPatientFolders } from '../fax/resolve-fax-source';
import { getPatientLastFirstName } from '../patients';
import { drawFieldLine } from './helpers/render/drawFieldLine';
import { DataComposer, generatePdf, PdfRenderConfig, StyleFactory } from './pdf-common';
import { rgbNormalized } from './pdf-utils';
import { AssetPaths, PdfData, PdfSection } from './types';

interface OrganizationBlock {
  /** Organization and person lines, in that order; "Any <specialty>" when the patient will choose. */
  nameLines: string[];
  address?: string;
  phone?: string;
  fax?: string;
}

export interface ReferralFormInput {
  serviceRequest: ServiceRequest;
  patient: Patient;
  practitioner?: Practitioner;
  /** The practice (the Organization behind ORGANIZATION_ID), the From block like the fax cover sheet. Absent when
   * that Organization cannot be loaded; the block then falls back to the visit's office alone. */
  practice?: Organization;
  /** The visit's office, when the referral belongs to a visit; its address and numbers win over the practice's. */
  location?: Location;
  recipient?: ReferralRecipient;
  timezone: string;
  oystehr: Oystehr;
}

interface ReferralFormData extends PdfData {
  patient: { name: string; dob: string; id: string; phone?: string };
  from: OrganizationBlock;
  to: OrganizationBlock;
  provider: { name: string; npi?: string; signatureName: string };
  referral: {
    referredAtISO?: string;
    timezone: string;
    specialty: string;
    reason: string;
    urgency: string;
    whatIsAsked: string;
    whoSchedules: string;
    documents: string;
    notes?: string;
    responseRequested: boolean;
  };
}

const telecom = (resource: Location | Organization | undefined, system: string): string | undefined =>
  resource?.telecom?.find((point) => point.system === system)?.value;

const composeReferralFormData: DataComposer<ReferralFormInput, ReferralFormData> = (input) => {
  const { serviceRequest, patient, practitioner, practice, location, recipient, timezone } = input;
  const details = getReferralDetails(serviceRequest);
  const specialty = getReferralSpecialty(serviceRequest);

  const practitionerName = practitioner?.name?.[0];
  const signatureName = practitionerName
    ? [practitionerName.given?.join(' '), practitionerName.family].filter(Boolean).join(' ')
    : '';
  const practiceFax = telecom(location, 'fax') ?? (practice ? getOrganizationFaxNumber(practice) : undefined);
  const practicePhone = telecom(location, 'phone') ?? telecom(practice, 'phone');

  return {
    patient: {
      name: getPatientLastFirstName(patient) ?? '',
      dob: formatDOB(patient.birthDate) ?? '',
      id: getPatientFriendlyId(patient) || patient.id || '',
      phone: standardizePhoneNumber(patient.telecom?.find((t) => t.system === 'phone')?.value),
    },
    from: {
      nameLines: [practice?.name ?? location?.name ?? ''],
      address: getAddressString(location?.address) || getAddressString(practice?.address?.[0]) || undefined,
      fax: standardizePhoneNumber(practiceFax) ?? practiceFax,
      phone: standardizePhoneNumber(practicePhone) ?? practicePhone,
    },
    to: recipient
      ? {
          nameLines: [recipient.organizationName, recipient.personName].filter((line): line is string => !!line),
          address: recipient.address,
          fax: standardizePhoneNumber(recipient.fax) ?? recipient.fax,
          phone: standardizePhoneNumber(recipient.phone) ?? recipient.phone,
        }
      : { nameLines: [`Any ${specialty}`] },
    provider: {
      name: practitioner ? getFullestAvailableName(practitioner) ?? '' : serviceRequest.requester?.display ?? '',
      npi: practitioner?.identifier?.find((id) => id.system === FHIR_IDENTIFIER_NPI)?.value,
      signatureName,
    },
    referral: {
      referredAtISO: serviceRequest.authoredOn,
      timezone,
      specialty,
      reason: getReferralReason(serviceRequest),
      urgency: REFERRAL_URGENCY_LABELS[getReferralUrgency(serviceRequest)],
      whatIsAsked: REFERRAL_ASK_LABELS[details?.whatIsAsked ?? REFERRAL_DEFAULTS.whatIsAsked],
      whoSchedules: REFERRAL_SCHEDULER_LABELS[details?.whoSchedules ?? REFERRAL_DEFAULTS.whoSchedules],
      documents: (details?.includeDocuments ?? []).map((kind) => FAX_DOCUMENT_LABELS[kind]).join(', ') || 'None',
      notes: getReferralNotesToRecipient(serviceRequest),
      responseRequested: details?.responseRequested ?? REFERRAL_DEFAULTS.responseRequested,
    },
  };
};

const referralFormAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Bold.otf',
    signature: './assets/DancingScript-Regular.otf',
  },
};

const createReferralFormStyles: StyleFactory = (assets) => {
  const bodyLine = { fontSize: 11, font: assets.fonts.regular, spacing: 2, newLineAfter: true };
  return {
    textStyles: {
      // `header` is the title style (rendered as a full-width banner)
      header: { fontSize: 16, font: assets.fonts.bold, spacing: 8, newLineAfter: true },
      sectionLabel: { fontSize: 12, font: assets.fonts.bold, spacing: 4, newLineAfter: true },
      orgName: { fontSize: 13, font: assets.fonts.bold, spacing: 3, newLineAfter: true },
      patientName: { fontSize: 13, font: assets.fonts.bold, spacing: 3, newLineAfter: true },
      specialtyHeading: { fontSize: 15, font: assets.fonts.bold, spacing: 6, newLineAfter: true },
      signature: { fontSize: 20, font: assets.fonts.signature, spacing: 5, newLineAfter: true },
      confidentiality: {
        fontSize: 10,
        font: assets.fonts.regular,
        color: rgbNormalized(68, 68, 68),
        spacing: 4,
        newLineAfter: true,
      },
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

type RenderArgs = Parameters<PdfSection<ReferralFormData, unknown>['render']>;

const drawOrganizationBlock = (
  client: RenderArgs[0],
  styles: RenderArgs[2],
  label: string,
  org: OrganizationBlock
): void => {
  client.drawText(label, styles.textStyles.sectionLabel);
  const nameLines = org.nameLines.filter(Boolean);
  if (!nameLines.length) nameLines.push('—');
  nameLines.forEach((line) => client.drawText(line, styles.textStyles.orgName));
  if (org.address) client.drawText(org.address, styles.textStyles.regular);
  if (org.fax) client.drawText(`Fax: ${org.fax}`, styles.textStyles.regular);
  if (org.phone) client.drawText(`Phone: ${org.phone}`, styles.textStyles.regular);
};

const fromColumn: PdfSection<ReferralFormData, OrganizationBlock> = {
  preferredWidth: 'column',
  dataSelector: (data) => data.from,
  render: (client, from, styles) => drawOrganizationBlock(client, styles, 'From:', from),
};

const toColumn: PdfSection<ReferralFormData, OrganizationBlock> = {
  preferredWidth: 'column',
  dataSelector: (data) => data.to,
  render: (client, to, styles) => drawOrganizationBlock(client, styles, 'To:', to),
};

const patientSection: PdfSection<ReferralFormData, ReferralFormData['patient']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.patient,
  render: (client, patient, styles) => {
    client.drawSeparatedLine(styles.lineStyles.separator);
    client.drawText('Patient:', styles.textStyles.sectionLabel);
    client.drawText(patient.name, styles.textStyles.patientName);
    const line = [
      patient.dob ? `DOB: ${patient.dob}` : '',
      `PID: ${patient.id}`,
      patient.phone ? `Phone: ${patient.phone}` : '',
    ]
      .filter(Boolean)
      .join('     ');
    client.drawText(line, styles.textStyles.regular);
  },
};

const referralSection: PdfSection<ReferralFormData, ReferralFormData> = {
  preferredWidth: 'full',
  dataSelector: (data) => data,
  render: (client, data, styles) => {
    const { referral, provider } = data;
    client.drawSeparatedLine(styles.lineStyles.separator);

    const referredAt = referral.referredAtISO ? formatDateForLabs(referral.referredAtISO, referral.timezone) : '';
    const providerBit = provider.name ? ` by ${provider.name}${provider.npi ? `, NPI: ${provider.npi}` : ''}` : '';
    client.drawText(`Referred ${referredAt}${providerBit}`.trim(), styles.textStyles.regular);

    client.drawText(referral.specialty, styles.textStyles.specialtyHeading);
    drawFieldLine(client, styles, { label: 'Specialty:', value: referral.specialty });
    drawFieldLine(client, styles, { label: 'Reason for referral:', value: referral.reason });
    drawFieldLine(client, styles, { label: 'Urgency:', value: referral.urgency });
    drawFieldLine(client, styles, { label: 'What is asked:', value: referral.whatIsAsked });
    drawFieldLine(client, styles, { label: 'Who schedules:', value: referral.whoSchedules });
    drawFieldLine(client, styles, { label: 'Documents included:', value: referral.documents });
    if (referral.notes) {
      drawFieldLine(client, styles, { label: 'Notes:', value: referral.notes });
    }

    client.newLine(8);
    drawFieldLine(client, styles, { label: 'Response requested:', value: referral.responseRequested ? 'Yes' : 'No' });
    if (referral.responseRequested) {
      client.drawText(REFERRAL_RESPONSE_REQUEST_TEXT, styles.textStyles.regular);
    }
  },
};

const signatureSection: PdfSection<ReferralFormData, ReferralFormData['provider']> = {
  preferredWidth: 'full',
  dataSelector: (data) => data.provider,
  shouldRender: (provider) => !!provider.signatureName,
  render: (client, provider, styles) => {
    client.newLine(48);
    client.drawText(provider.signatureName, styles.textStyles.signature);
    client.drawText(provider.name, styles.textStyles.regular);
  },
};

const confidentialitySection: PdfSection<ReferralFormData, ReferralFormData> = {
  preferredWidth: 'full',
  dataSelector: (data) => data,
  render: (client, _data, styles) => {
    client.newLine(24);
    client.drawText(HIPAA_FAX_CONFIDENTIALITY_STATEMENT, styles.textStyles.confidentiality);
  },
};

const referralFormRenderConfig: PdfRenderConfig<ReferralFormData> = {
  header: { title: 'SPECIALIST REFERRAL', titleLayout: 'banner' },
  headerBodySeparator: false,
  assetPaths: referralFormAssetPaths,
  styleFactory: createReferralFormStyles,
  sections: [fromColumn, toColumn, patientSection, referralSection, signatureSection, confidentialitySection],
};

/**
 * Generates the one-page referral form (via the shared pdf-common engine), uploads it to the referrals
 * bucket, files it in the patient's Referrals folder through a DocumentReference (context.related →
 * ServiceRequest) and returns a presigned URL to print. Prior forms for the referral are superseded.
 */
export async function createReferralFormPDF(
  input: ReferralFormInput,
  refs: { patientId: string; encounterId?: string; referralId: string },
  secrets: Secrets | null,
  token: string,
  sourceVersion?: string
): Promise<{ documentReference: DocumentReference; presignedURL: string }> {
  const { patientId, encounterId, referralId } = refs;

  const [{ pdfInfo }, listResources] = await Promise.all([
    generatePdf(
      input,
      composeReferralFormData,
      referralFormRenderConfig,
      { patientId, fileName: 'ReferralForm.pdf', bucketName: BUCKET_NAMES.REFERRALS },
      secrets,
      token
    ),
    getPatientFolders(input.oystehr, patientId),
  ]);

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: pdfInfo.uploadURL, title: pdfInfo.title }],
    type: { coding: [REFERRAL_FORM_DOC_REF_DOCTYPE], text: REFERRAL_FORM_DOC_REF_DOCTYPE.display },
    references: {
      subject: { reference: `Patient/${patientId}` },
      context: {
        related: [{ reference: `ServiceRequest/${referralId}` }],
        ...(encounterId ? { encounter: [{ reference: `Encounter/${encounterId}` }] } : {}),
      },
      ...(sourceVersion
        ? { identifier: [{ system: REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM, value: sourceVersion }] }
        : {}),
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr: input.oystehr,
    // supersede prior forms for this referral; the type filter leaves filed responses alone
    searchParams: [
      { name: 'related', value: `ServiceRequest/${referralId}` },
      { name: 'type', value: `${REFERRAL_FORM_DOC_REF_DOCTYPE.system}|${REFERRAL_FORM_DOC_REF_DOCTYPE.code}` },
    ],
    generateUUID: randomUUID,
    listResources,
  });

  if (!docRefs.length) {
    throw new Error('Unable to make DocumentReference for referral form');
  }

  const presignedURL = await getPresignedURL(pdfInfo.uploadURL, token);
  if (!presignedURL) {
    throw new Error('Failed to get presigned URL for referral form PDF');
  }

  return { documentReference: docRefs[0], presignedURL };
}
