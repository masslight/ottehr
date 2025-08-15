import Oystehr from '@oystehr/sdk';
import { appointmentTypeLabels } from 'ehr-ui/src/types/types';
import {
  Account,
  Appointment,
  Encounter,
  FhirResource,
  List,
  Location,
  Organization,
  Patient,
  PaymentNotice,
} from 'fhir/r4b';
import fs from 'fs';
import { capitalize } from 'lodash';
import { DateTime } from 'luxon';
import { PageSizes } from 'pdf-lib';
import Stripe from 'stripe';
import {
  CashOrCardPayment,
  FhirAppointmentType,
  getFullName,
  getPatientAddress,
  getPhoneNumberForIndividual,
  getSecret,
  getStripeCustomerIdFromAccount,
  PAYMENT_METHOD_EXTENSION_URL,
  removePrefix,
  Secrets,
  SecretsKeys,
} from 'utils';
import { makeReceiptPdfDocumentReference } from '../../ehr/change-telemed-appointment-status/helpers/helpers';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { createOystehrClient } from '../helpers';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../stripeIntegration';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { STANDARD_NEW_LINE } from './pdf-consts';
import { createPdfClient, PdfInfo, SEPARATED_LINE_STYLE as GREY_LINE_STYLE } from './pdf-utils';
import { ImageStyle, PdfClientStyles, TextStyle } from './types';

interface PaymentData {
  amount: number;
  method: CashOrCardPayment['paymentMethod'];
  paymentDate?: string;
  last4?: string;
  brand?: string;
  isPrimary?: boolean;
}

interface PatientPaymentReceiptData {
  receiptDate: string;
  payments: PaymentData[];
  listResources: List[];
  visitData: {
    date: string;
    time: string;
    type: string;
    location?: string;
  };
  organization: {
    name: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    phone?: string;
  };
  patient: {
    id: string;
    name: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    phone?: string;
  };
}

// lastOperationPaymentIntent is used to fill Stripe data for last (card) payment
// by default we fetch all Stripe processed payments and last one might be not there if it's a freshly created payment
export async function createPatientPaymentReceiptPdf(
  encounterId: string,
  patientId: string,
  secrets: Secrets | null,
  oystehrToken: string,
  lastOperationPaymentIntent?: Stripe.PaymentIntent
): Promise<PdfInfo> {
  const stripeClient = getStripeClient(secrets);
  const oystehr = createOystehrClient(oystehrToken, secrets);
  const billingOrganizationRef = getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets);
  const billingOrganizationId = removePrefix('Organization/', billingOrganizationRef);
  if (!billingOrganizationId) throw new Error('No DEFAULT_BILLING_RESOURCE organization id found');

  const receiptData = await getReceiptData(
    encounterId,
    patientId,
    billingOrganizationId,
    oystehr,
    stripeClient,
    lastOperationPaymentIntent
  );
  console.log('Got receipt data: ', JSON.stringify(receiptData));
  console.log('Creating receipt pdf');
  const receiptPdf = await createReceiptPdf(receiptData);
  console.log('Created receipt pdf');

  const pdfInfo = await createReplaceReceiptOnZ3(
    receiptPdf,
    receiptData.patient.id,
    encounterId,
    secrets,
    oystehrToken
  );
  const docRef = await makeReceiptPdfDocumentReference(
    oystehr,
    pdfInfo,
    patientId,
    encounterId,
    receiptData.listResources
  );
  console.log('Created document reference: ', JSON.stringify(docRef));
  return pdfInfo;
}

async function getReceiptData(
  encounterId: string,
  patientId: string,
  organizationId: string,
  oystehr: Oystehr,
  stripeClient: Stripe,
  lastOperationPaymentIntent?: Stripe.PaymentIntent
): Promise<PatientPaymentReceiptData> {
  const accountResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
  const account: Account | undefined = accountResources.account;
  const customerId = account ? getStripeCustomerIdFromAccount(account) : undefined;
  if (!customerId) throw new Error('No stripe customer id found');

  const [fhirBundle, listResourcesBundle, organization, paymentIntents, customer, paymentMethods] = await Promise.all([
    oystehr.fhir.search<FhirResource>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_revinclude', value: 'PaymentNotice:request' },
        { name: '_include', value: 'Encounter:subject' },
        { name: '_include', value: 'Encounter:appointment' },
      ],
    }),
    oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'patient', value: `Patient/${patientId}` }],
    }),
    oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId }),
    stripeClient.paymentIntents.search({
      query: `metadata['encounterId']:"${encounterId}" OR metadata['oystehr_encounter_id']:"${encounterId}"`,
      limit: 20, // default is 10
    }),
    stripeClient.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method', 'sources'],
    }),
    stripeClient.paymentMethods.list({
      customer: customerId,
      type: 'card',
    }),
  ]);
  // find resources
  const resources = fhirBundle.unbundle();
  const paymentNotices = resources.filter((r) => r.resourceType === 'PaymentNotice') as PaymentNotice[];
  const patient = resources.find((r) => r.resourceType === 'Patient') as Patient;
  const appointment = resources.find((r) => r.resourceType === 'Appointment') as Appointment;
  const encounter = resources.find((r) => r.resourceType === 'Encounter') as Encounter;
  if (!organization || !patient || !appointment || !encounter)
    throw new Error('One of the required resources is not found');

  const locationId = removePrefix('Location/', encounter.location?.[0].location.reference ?? '');
  const location: Location | undefined = locationId
    ? await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId })
    : undefined;
  const locationName = location?.name;

  // parse data
  if (customer.deleted) throw new Error('Customer is deleted');
  const payments = parsePaymentsList(
    paymentNotices,
    paymentIntents.data,
    customer,
    paymentMethods.data,
    lastOperationPaymentIntent
  );

  const listResources = listResourcesBundle.unbundle();
  const patientAddress = getPatientAddress(patient.address);
  const patientPhone = getPhoneNumberForIndividual(patient);
  const orgPhone = (organization.telecom ?? []).find((cp) => {
    return cp.system === 'phone' && cp.value;
  })?.value;
  const visitDate = DateTime.fromISO(appointment.start ?? '');
  const organizationAddress = organization.address?.[0];
  const appointmentType = (appointment?.appointmentType?.text as FhirAppointmentType) || '';
  const visitType = appointmentTypeLabels[appointmentType];

  return {
    receiptDate: payments.at(-1)?.paymentDate ?? '??',
    payments,
    listResources,
    visitData: {
      date: visitDate.toFormat('MM/dd/yyyy'),
      time: visitDate.toFormat('hh:mm a'),
      type: visitType,
      location: locationName,
    },
    organization: {
      name: organization?.name ?? '??',
      street: organizationAddress?.line?.[0] ?? '??',
      street2: organizationAddress?.line?.[1],
      city: organizationAddress?.city ?? '??',
      state: organizationAddress?.state ?? '??',
      zip: organizationAddress?.postalCode ?? '??',
      phone: orgPhone,
    },
    patient: {
      id: patient.id!,
      name: getFullName(patient) ?? '??',
      street: patientAddress.addressLine ?? '??',
      street2: patientAddress.addressLine2,
      city: patientAddress.city ?? '??',
      state: patientAddress.state ?? '??',
      zip: patientAddress.postalCode ?? '??',
      phone: patientPhone,
    },
  };
}

function parsePaymentsList(
  paymentNotices: PaymentNotice[],
  paymentIntents: Stripe.PaymentIntent[],
  customer: Stripe.Customer,
  paymentMethods: Stripe.PaymentMethod[],
  lastOperationPaymentIntent?: Stripe.PaymentIntent
): PaymentData[] {
  if (lastOperationPaymentIntent) paymentIntents.push(lastOperationPaymentIntent);
  const defaultPaymentMethod: Stripe.PaymentMethod = customer.invoice_settings
    ?.default_payment_method as Stripe.PaymentMethod;

  const payments: PaymentData[] = paymentNotices.map((paymentNotice) => {
    const pnStripeId = paymentNotice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
    const stripeIntent = paymentIntents.find((pi) => pi.id === pnStripeId);
    const stripeMethod = paymentMethods.find((pm) => pm.id === stripeIntent?.payment_method);

    const amount = paymentNotice.amount.value;
    const method = paymentNotice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)
      ?.valueString as CashOrCardPayment['paymentMethod'];

    if (!amount) throw new Error('No amount found');
    return {
      amount,
      method,
      // todo: what date should i put here?
      paymentDate: paymentNotice?.created,
      last4: stripeMethod?.card?.last4,
      brand: stripeMethod?.card?.brand,
      isPrimary: stripeMethod?.id === defaultPaymentMethod?.id,
    };
  });
  // i do sorting before formatting date to MM/dd/yyyy to make it more precise
  payments.sort((a, b) => {
    const dateA = DateTime.fromISO(a.paymentDate ?? '');
    const dateB = DateTime.fromISO(b.paymentDate ?? '');
    return dateA.diff(dateB).milliseconds;
  });
  payments.forEach(
    (payment) => (payment.paymentDate = DateTime.fromISO(payment.paymentDate ?? '').toFormat('MM/dd/yyyy'))
  );
  return payments;
}

async function createReceiptPdf(receiptData: PatientPaymentReceiptData): Promise<Uint8Array> {
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        top: 24,
        bottom: 24,
        right: 24,
        left: 24,
      },
    },
  };

  const pdfClient = await createPdfClient(pdfClientStyles);
  const RubikFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const RubikFontMedium = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Medium.ttf'));
  const ottehrLogo = await pdfClient.embedImage(fs.readFileSync('./assets/ottehrLogo.png'));

  const textStyles: Record<string, TextStyle> = {
    header: {
      fontSize: 16,
      spacing: 8,
      font: RubikFontMedium,
      side: 'right',
    },
    blockHeader: {
      fontSize: 14,
      spacing: 3,
      font: RubikFontMedium,
      newLineAfter: true,
    },
    text: {
      fontSize: 12,
      spacing: 3,
      font: RubikFont,
      newLineAfter: true,
    },
  };

  const drawBlockHeader = (text: string): void => {
    pdfClient.drawText(text, textStyles.blockHeader);
  };

  const writeText = (
    text: string,
    params?: {
      side?: 'left' | 'right';
      noNewLineAfter?: boolean;
      bold?: boolean;
      fontSize?: number;
      spacing?: number;
    }
  ): void => {
    const styles = { ...textStyles.text };
    if (params?.side) styles.side = params.side;
    if (params?.noNewLineAfter) delete styles.newLineAfter;
    if (params?.bold) styles.font = RubikFontMedium;
    if (params?.fontSize) styles.fontSize = params.fontSize;
    if (params?.spacing) styles.spacing = params.spacing;
    pdfClient.drawText(text, styles);
  };

  const drawHeadline = (): void => {
    const imgStyles: ImageStyle = {
      width: 120,
      height: 30,
    };
    pdfClient.drawImage(ottehrLogo, imgStyles);
    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient.drawText('RECEIPT', textStyles.header);
    pdfClient.setY(pdfClient.getY() - imgStyles.height); // new line after image
  };

  const drawVisitDetails = (): void => {
    const visit = `${receiptData.visitData.type} | ${receiptData.visitData.time} | ${receiptData.visitData.date}`;
    const textWidth = pdfClient.getTextDimensions(`Visit: ${visit}`, textStyles.text).width;
    pdfClient.setX(pdfClient.getRightBound() - textWidth - 5);
    pdfClient.drawTextSequential('Visit: ', { ...textStyles.text, font: RubikFontMedium, newLineAfter: false });
    pdfClient.drawTextSequential(visit, textStyles.text);

    pdfClient.drawTextSequential('Receipt date: ', { ...textStyles.text, font: RubikFontMedium, newLineAfter: false });
    pdfClient.drawTextSequential(`${receiptData.receiptDate}`, { ...textStyles.text, newLineAfter: false });

    if (receiptData.visitData.location) writeText(`${receiptData.visitData.location}`, { side: 'right' });
    else pdfClient.newLine(STANDARD_NEW_LINE);
  };

  const drawOrganizationAndPatientDetails = (): void => {
    const pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
    const initialRightBound = pdfClient.getRightBound();
    const initialLeftBound = pdfClient.getLeftBound();
    const beforeColumnsY = pdfClient.getY();

    // Patient column
    // Setting bounds for the first column
    pdfClient.setRightBound(pageWidth / 2);

    drawBlockHeader(receiptData.patient.name);
    writeText(`${receiptData.patient.street}`);
    if (receiptData.patient.street2) writeText(`${receiptData.patient.street2}`);
    writeText(`${receiptData.patient.city}, ${receiptData.patient.state} ${receiptData.patient.zip}`);
    if (receiptData.patient.phone) writeText(`${receiptData.patient.phone}`);

    const afterFirstColumn = pdfClient.getY();

    // Organization column
    // Setting Y to the start of the table
    pdfClient.setY(beforeColumnsY);

    // Setting new bounds for the second column
    pdfClient.setRightBound(initialRightBound);
    pdfClient.setLeftBound(pageWidth / 2);

    drawBlockHeader(receiptData.organization.name);
    writeText(`${receiptData.organization.street}`);
    if (receiptData.organization.street2) writeText(`${receiptData.organization.street2}`);
    writeText(`${receiptData.organization.city}, ${receiptData.organization.state} ${receiptData.organization.zip}`);
    if (receiptData.organization.phone) writeText(`${receiptData.organization.phone}`);

    // Setting Y to the minimum so cursor will be at the bottom of the table
    if (afterFirstColumn < pdfClient.getY()) pdfClient.setY(afterFirstColumn);
    else pdfClient.setY(pdfClient.getY());

    pdfClient.setLeftBound(initialLeftBound);
  };

  const drawPaymentDetails = (): void => {
    const tableWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
    const firstColumnWidth = tableWidth / 2;
    const otherColumnWidth = tableWidth / 4;
    const initialLeftBound = pdfClient.getLeftBound();
    let totalAmount = 0;

    drawBlockHeader('Payments');

    // Payments list
    receiptData.payments.forEach((payment) => {
      let cardText = `Card ending ${payment.last4}`;
      if (payment.isPrimary) cardText += ' (Primary)';
      const paymentMethodText = payment.method === 'card' ? cardText : capitalize(payment.method);
      totalAmount += payment.amount;

      pdfClient.setRightBound(initialLeftBound + firstColumnWidth);
      writeText(paymentMethodText, { noNewLineAfter: true, spacing: 0 });

      pdfClient.setLeftBound(initialLeftBound + firstColumnWidth);
      pdfClient.setRightBound(initialLeftBound + firstColumnWidth + otherColumnWidth);

      writeText(`${payment.paymentDate}`, { noNewLineAfter: true });
      pdfClient.setLeftBound(initialLeftBound + firstColumnWidth + otherColumnWidth);
      pdfClient.setRightBound(initialLeftBound + firstColumnWidth + otherColumnWidth * 2);

      writeText(`$ ${payment.amount}`, { side: 'right' });
      pdfClient.setLeftBound(initialLeftBound);
      const grayLine = { ...GREY_LINE_STYLE };
      grayLine.margin = { top: 5, bottom: 1 };
      pdfClient.drawSeparatedLine(grayLine);
    });

    // Totals
    writeText(`Total:`, { noNewLineAfter: true, bold: true });
    writeText(`$ ${totalAmount}`, { side: 'right', bold: true });
  };

  drawHeadline();
  drawVisitDetails();
  pdfClient.drawSeparatedLine(GREY_LINE_STYLE);
  pdfClient.newLine(STANDARD_NEW_LINE);
  drawOrganizationAndPatientDetails();
  pdfClient.newLine(56);
  drawPaymentDetails();

  return await pdfClient.save();
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

async function createReplaceReceiptOnZ3(
  pdfBytes: Uint8Array,
  patientId: string,
  encounterId: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  const bucketName = 'receipts';
  const fileName = `${encounterId}.pdf`;
  console.log('Creating base file url');
  const baseFileUrl = makeReceiptZ3Url(secrets, bucketName, fileName, patientId);
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  // savePdfLocally(pdfBytes);
  return { title: fileName, uploadURL: baseFileUrl };
}

const makeReceiptZ3Url = (secrets: Secrets | null, bucketName: string, fileName: string, patientId: string): string => {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${projectId}-${bucketName}/${patientId}/${fileName}`;
  console.log('created z3 url: ', fileURL);
  return fileURL;
};
