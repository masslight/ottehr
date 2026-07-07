import Oystehr, { User } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location, Practitioner, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PDFDocument } from 'pdf-lib';
import {
  BUCKET_NAMES,
  EMPLOYEE_ID_SYSTEM,
  FAX_SENT_PROVENANCE_ACTIVITY_CODING,
  FaxRecipient,
  formatDOB,
  formatPhoneNumberDisplay,
  getAddressStringForScheduleResource,
  getFullestAvailableName,
  getFullName,
  getSecret,
  PARTICIPATION_CODE_SYSTEM,
  SecretsKeys,
  SendFaxZambdaInput,
  SendFaxZambdaOutput,
  uploadPDF,
} from 'utils';
import { checkOrCreateM2MClientToken, getUser, wrapHandler, ZambdaInput } from '../../shared';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { createFaxCoverPagePdfBytes, FaxCoverPageData } from '../../shared/pdf/fax-documents-pdf';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { FullAppointmentResourcePackage } from '../../shared/pdf/visit-details-pdf/types';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { gatherFaxDocuments, mergePdfBytes } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'send-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters()');
  const validatedInput = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters() success');
  console.log(
    'appointmentId',
    validatedInput.appointmentId,
    'documents',
    JSON.stringify(validatedInput.documents),
    'recipients',
    validatedInput.recipients.length
  );

  const authorization = input.headers.Authorization;
  const user = await getUser(authorization.replace('Bearer ', ''), validatedInput.secrets);

  console.group('checkOrCreateM2MClientToken() then createOystehrClient()');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);
  console.groupEnd();
  console.debug('checkOrCreateM2MClientToken() then createOystehrClient() success');

  console.group('complexValidation()');
  const effectInput = await complexValidation(validatedInput, oystehr, user);
  console.groupEnd();
  console.debug('complexValidation() success');

  console.group('performEffect()');
  const response = await performEffect(effectInput, oystehr, user);
  console.groupEnd();
  console.debug('performEffect() success', response.statusCode);

  return response;
});

interface EffectInput extends SendFaxZambdaInput, Pick<ZambdaInput, 'secrets'> {
  organizationId: string;
  visitResources: FullAppointmentResourcePackage;
  userPractitioner: Practitioner;
}

const complexValidation = async (
  validatedInput: SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  user: User
): Promise<EffectInput> => {
  const { appointmentId, secrets } = validatedInput;
  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

  console.log('searching fhir for the visit resources and the sending user');
  const [visitResources, userPractitioner] = await Promise.all([
    getAppointmentAndRelatedResources(oystehr, appointmentId, true),
    oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: user.profile.split('/')[1],
    }),
  ]);

  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
  }
  if (!visitResources.patient?.id) {
    throw new Error(`Patient data is missing for appointment ${appointmentId}`);
  }

  return { ...validatedInput, organizationId, visitResources, userPractitioner };
};

const getProjectFaxNumber = async (oystehr: Oystehr): Promise<string | undefined> => {
  try {
    const configuration = await oystehr.fax.getConfiguration();
    return configuration.faxNumbers?.[0];
  } catch (error) {
    console.error('Failed to fetch fax service configuration:', error);
    return undefined;
  }
};

const activeTelecomValue = (location: Location | undefined, system: 'phone' | 'fax'): string | undefined =>
  location?.telecom?.find((telecom) => telecom.system === system && telecom.period?.end === undefined)?.value;

const performEffect = async (
  input: EffectInput,
  oystehr: Oystehr,
  user: User
): Promise<{ body: string; statusCode: number }> => {
  const { documents, recipients, organizationId, visitResources, userPractitioner, secrets, timezone } = input;
  const { appointment, patient, location } = visitResources;
  const patientId = patient!.id!;
  const effectiveTimezone = timezone ?? visitResources.timezone;

  console.log('gathering fax documents:', JSON.stringify(documents));
  const documentPdfBytes = await gatherFaxDocuments({
    documents,
    visitResources,
    oystehr,
    m2mToken,
    secrets,
  });
  const documentsPdf = await mergePdfBytes(documentPdfBytes);
  const documentPageCount = documentsPdf.getPageCount();
  console.log(`gathered ${documentPdfBytes.length} document PDF(s), ${documentPageCount} page(s) total`);

  const projectFaxNumber = await getProjectFaxNumber(oystehr);
  const visitDate = appointment.start
    ? DateTime.fromISO(appointment.start).setZone(effectiveTimezone).toFormat('MM/dd/yyyy')
    : '';

  const senderAddress = getAddressStringForScheduleResource(location);
  const coverPageBase: Omit<FaxCoverPageData, 'recipient' | 'totalPages'> = {
    sender: {
      facilityName: location?.name ?? '',
      addressLines: senderAddress ? [senderAddress] : [],
      phone: formatPhoneNumberDisplay(activeTelecomValue(location, 'phone')) || undefined,
      fax: formatPhoneNumberDisplay(activeTelecomValue(location, 'fax') ?? projectFaxNumber) || undefined,
      transmissionDateTime: DateTime.now().setZone(effectiveTimezone).toFormat('MM/dd/yyyy h:mm a ZZZZ'),
      sentBy: getFullestAvailableName(userPractitioner) ?? '',
    },
    patient: {
      fullName: getFullName(patient!),
      dob: formatDOB(patient?.birthDate) ?? '',
    },
    reLine: `Re: Urgent Care Encounter${visitDate ? `, ${visitDate}` : ''}`,
  };

  const failedFaxNumbers: string[] = [];
  let faxesSent = 0;

  for (const recipient of recipients) {
    try {
      await sendFaxToRecipient({
        recipient,
        coverPageBase,
        documentsPdf,
        documentPageCount,
        organizationId,
        patientId,
        appointmentId: input.appointmentId,
        userPractitioner,
        user,
        oystehr,
        secrets,
      });
      faxesSent++;
    } catch (error) {
      console.error(`Failed to send fax to ${recipient.faxNumber}:`, error);
      captureException(error);
      failedFaxNumbers.push(recipient.faxNumber);
    }
  }

  if (faxesSent === 0) {
    throw new Error(`Failed to send fax to ${failedFaxNumbers.map((n) => formatPhoneNumberDisplay(n)).join(', ')}`);
  }

  const output: SendFaxZambdaOutput = {
    message:
      failedFaxNumbers.length === 0
        ? `Fax sent to ${faxesSent} recipient(s)`
        : `Fax sent to ${faxesSent} recipient(s); failed for ${failedFaxNumbers
            .map((n) => formatPhoneNumberDisplay(n))
            .join(', ')}`,
    faxesSent,
    failedFaxNumbers,
  };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
  };
};

interface SendFaxToRecipientInput {
  recipient: FaxRecipient;
  coverPageBase: Omit<FaxCoverPageData, 'recipient' | 'totalPages'>;
  documentsPdf: PDFDocument;
  documentPageCount: number;
  organizationId: string;
  patientId: string;
  appointmentId: string;
  userPractitioner: Practitioner;
  user: User;
  oystehr: Oystehr;
  secrets: ZambdaInput['secrets'];
}

const sendFaxToRecipient = async (input: SendFaxToRecipientInput): Promise<void> => {
  const {
    recipient,
    coverPageBase,
    documentsPdf,
    documentPageCount,
    organizationId,
    patientId,
    appointmentId,
    userPractitioner,
    user,
    oystehr,
    secrets,
  } = input;

  const coverPageData = (totalPages: number): FaxCoverPageData => ({
    ...coverPageBase,
    recipient: {
      ...recipient,
      faxNumber: formatPhoneNumberDisplay(recipient.faxNumber),
      phoneNumber: recipient.phoneNumber ? formatPhoneNumberDisplay(recipient.phoneNumber) : undefined,
    },
    totalPages,
  });

  // The cover page is expected to fit on one page; verify and re-render with the
  // corrected count in case it ever spills over.
  let coverBytes = await createFaxCoverPagePdfBytes(coverPageData(documentPageCount + 1), m2mToken);
  const coverPageCount = (await PDFDocument.load(coverBytes)).getPageCount();
  if (coverPageCount !== 1) {
    coverBytes = await createFaxCoverPagePdfBytes(coverPageData(documentPageCount + coverPageCount), m2mToken);
  }

  const merged = await PDFDocument.create();
  const coverPdf = await PDFDocument.load(coverBytes);
  const coverPages = await merged.copyPages(coverPdf, coverPdf.getPageIndices());
  coverPages.forEach((page) => merged.addPage(page));
  const documentPages = await merged.copyPages(documentsPdf, documentsPdf.getPageIndices());
  documentPages.forEach((page) => merged.addPage(page));
  const mergedBytes = await merged.save();

  const faxFileUrl = makeZ3Url({
    secrets,
    bucketName: BUCKET_NAMES.FAXES,
    patientID: patientId,
    fileName: `Fax-${recipient.faxNumber.replace(/\D/g, '')}.pdf`,
  });
  await uploadPDF(mergedBytes, faxFileUrl, m2mToken, patientId);
  console.log('Uploaded merged fax document:', faxFileUrl);

  console.log('Sending fax to', recipient.faxNumber);
  const { communicationResource: fax } = await oystehr.fax.send({
    media: faxFileUrl,
    quality: 'standard',
    patient: `Patient/${patientId}`,
    recipientNumber: recipient.faxNumber,
    sender: `Organization/${organizationId}`,
  });
  console.log('Fax sent successfully');

  // Strip the +1 country code prefix and any non-digit characters to produce a valid FHIR id
  const containedId = recipient.faxNumber.replace(/^\+1/, '').replace(/\D/g, '');
  console.log('Creating provenance for fax');
  const provenance = await oystehr.fhir.create<Provenance>({
    resourceType: 'Provenance',
    target: [
      {
        reference: `Communication/${fax.id!}`,
      },
      {
        reference: `Appointment/${appointmentId}`,
      },
    ],
    occurredDateTime: fax.sent,
    recorded: DateTime.now().toUTC().toISO(),
    activity: {
      coding: [FAX_SENT_PROVENANCE_ACTIVITY_CODING],
    },
    agent: [
      {
        role: [
          {
            coding: [
              {
                system: PARTICIPATION_CODE_SYSTEM,
                code: 'AUT',
                display: 'author',
              },
            ],
          },
        ],
        who: {
          reference: `Practitioner/${userPractitioner.id}`,
          display: getFullestAvailableName(userPractitioner),
          identifier: {
            value: user.id,
            system: EMPLOYEE_ID_SYSTEM,
          },
        },
        onBehalfOf: {
          reference: `Organization/${organizationId}`,
        },
      },
      {
        role: [
          {
            coding: [
              {
                system: PARTICIPATION_CODE_SYSTEM,
                code: 'SBJ',
                display: 'subject',
              },
            ],
          },
        ],
        who: {
          reference: `Patient/${patientId}`,
        },
      },
      {
        role: [
          {
            coding: [
              {
                system: PARTICIPATION_CODE_SYSTEM,
                code: 'RCV',
                display: 'receiver',
              },
            ],
          },
        ],
        who: {
          reference: `#${containedId}`,
        },
      },
    ],
    contained: [
      {
        resourceType: 'Practitioner',
        id: containedId,
        ...(recipient.name ? { name: [{ text: recipient.name }] } : {}),
        telecom: [
          {
            system: 'fax',
            value: recipient.faxNumber,
          },
        ],
      },
    ],
  });
  console.log('Fax provenance created successfully', provenance.id);
};
