import Oystehr from '@oystehr/sdk';
import { Account, Appointment, FhirResource, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { PageSizes } from 'pdf-lib';
import Stripe from 'stripe';
import {
  CashOrCardPayment,
  getFullName,
  getPatientAddress,
  getSecret,
  getStripeCustomerIdFromAccount,
  PAYMENT_METHOD_EXTENSION_URL,
  removePrefix,
  Secrets,
  SecretsKeys,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { createOystehrClient } from '../helpers';
import { makeZ3Url } from '../presigned-file-urls';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../stripeIntegration';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { STANDARD_NEW_LINE } from './pdf-consts';
import { createPdfClient, PdfInfo, rgbNormalized } from './pdf-utils';
import { ImageStyle, PdfClientStyles, TextStyle } from './types';

interface PaymentData {
  amount: number;
  method: CashOrCardPayment['paymentMethod'];
  last4?: string;
  brand?: string;
}

interface PatientPaymentReceiptData {
  receiptDate: string;
  visitDate: string;
  payments: PaymentData[];
  organization: {
    name: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
  patient: {
    id: string;
    name: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
}

export async function createPatientPaymentReceiptPdf(
  encounterId: string,
  patientId: string,
  secrets: Secrets | null,
  oystehrToken: string
): Promise<PdfInfo> {
  const stripeClient = getStripeClient(secrets);
  const oystehr = createOystehrClient(oystehrToken, secrets);
  const billingOrganizationRef = getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets);
  const billingOrganizationId = removePrefix('Organization/', billingOrganizationRef);
  if (!billingOrganizationId) throw new Error('No DEFAULT_BILLING_RESOURCE organization id found');

  const receiptData = await getReceiptData(encounterId, patientId, billingOrganizationId, oystehr, stripeClient);
  console.log('Got receipt data: ', JSON.stringify(receiptData));
  console.log('Creating receipt pdf');
  const receiptPdf = await createReceiptPdf(receiptData);
  console.log('Created receipt pdf');

  return await createReplaceReceiptOnZ3(receiptPdf, receiptData.patient.id, secrets, oystehrToken);
}

async function getReceiptData(
  encounterId: string,
  patientId: string,
  organizationId: string,
  oystehr: Oystehr,
  stripeClient: Stripe
): Promise<PatientPaymentReceiptData> {
  const accountResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
  const account: Account | undefined = accountResources.account;
  const customerId = account ? getStripeCustomerIdFromAccount(account) : undefined;

  const [fhirBundle, organization, paymentIntents, pms] = await Promise.all([
    oystehr.fhir.search<FhirResource>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_revinclude', value: 'PaymentNotice:request' },
        { name: '_include', value: 'Encounter:subject' },
        { name: '_include', value: 'Encounter:appointment' },
      ],
    }),
    oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId }),
    stripeClient.paymentIntents.search({
      query: `metadata['encounterId']:"${encounterId}" OR metadata['oystehr_encounter_id']:"${encounterId}"`,
      limit: 20, // default is 10
    }),
    stripeClient.paymentMethods.list({
      customer: customerId,
      type: 'card',
    }),
  ]);
  const stripePayments = paymentIntents.data;
  const paymentMethods = pms.data;

  const resources = fhirBundle.unbundle();
  const patient = resources.find((r) => r.resourceType === 'Patient') as Patient;
  const patientAddress = getPatientAddress(patient.address);
  const appointment = resources.find((r) => r.resourceType === 'Appointment') as Appointment;
  const paymentNoticess = resources.filter((r) => r.resourceType === 'PaymentNotice') as PaymentNotice[];

  const payments: PaymentData[] = paymentNoticess.map((paymentNotice) => {
    const method = paymentNotice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)
      ?.valueString as CashOrCardPayment['paymentMethod'];

    const pnStripeId = paymentNotice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
    const paymentIntent = stripePayments.find((pi) => pi.id === pnStripeId);
    const last4 = paymentMethods.find((pm) => pm.id === paymentIntent?.payment_method)?.card?.last4;
    const brand = paymentMethods.find((pm) => pm.id === paymentIntent?.payment_method)?.card?.brand;

    return {
      amount: paymentNotice.amount.value ?? -1,
      method: method,
      last4,
      brand,
    };
  });
  const organizationAddress = organization.address?.[0];
  if (!organization) throw new Error('Organization not found');
  if (!patient) throw new Error('Patient not found');
  if (!appointment) throw new Error('Appointment not found');
  // todo: what date should i use as visitDate?
  return {
    receiptDate: DateTime.now().toFormat('MM/dd/yyyy'),
    visitDate: DateTime.fromISO(appointment.end ?? '').toFormat('MM/dd/yyyy'),
    payments,
    organization: {
      name: organization?.name ?? '',
      street: organizationAddress?.line?.[0] ?? '',
      street2: organizationAddress?.line?.[1],
      city: organizationAddress?.city ?? '',
      state: organizationAddress?.state ?? '',
      zip: organizationAddress?.postalCode ?? '',
    },
    patient: {
      id: patient.id!,
      name: getFullName(patient) ?? '',
      street: patientAddress.addressLine ?? '',
      street2: patientAddress.addressLine2,
      city: patientAddress.city ?? '',
      state: patientAddress.state ?? '',
      zip: patientAddress.postalCode ?? '',
    },
  };
}

async function createReceiptPdf(receiptData: PatientPaymentReceiptData): Promise<Uint8Array> {
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        top: 40,
        bottom: 40,
        right: 37,
        left: 37,
      },
    },
  };

  console.log('creating client');
  const pdfClient = await createPdfClient(pdfClientStyles);
  console.log('created client');
  const RubikFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const ottehrLogo = await pdfClient.embedImage(fs.readFileSync('./assets/ottehrLogo.png'));

  const textStyles: Record<string, TextStyle> = {
    header: {
      fontSize: 18,
      spacing: 8,
      font: RubikFont,
      side: 'right',
      color: rgbNormalized(48, 19, 103),
    },
    blockHeader: {
      fontSize: 16,
      spacing: 8,
      font: RubikFont,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    text: {
      fontSize: 11,
      spacing: 1,
      font: RubikFont,
      newLineAfter: true,
    },
    inlineText: {
      fontSize: 11,
      spacing: 1,
      font: RubikFont,
    },
  };

  const drawBlockHeader = (text: string): void => {
    pdfClient.drawText(text, textStyles.blockHeader);
  };

  const regularText = (text: string): void => {
    pdfClient.drawText(text, textStyles.text);
  };

  const drawHeadline = (): void => {
    const imgStyles: ImageStyle = {
      width: 190,
      height: 47,
    };
    pdfClient.drawImage(ottehrLogo, imgStyles);
    pdfClient.drawText('Receipt', textStyles.header);
    pdfClient.setY(pdfClient.getY() - imgStyles.height); // new line after image
  };

  const drawOrganizationAndPatientDetails = (): void => {
    const pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
    const initialRightBound = pdfClient.getRightBound();
    const initialLeftBound = pdfClient.getLeftBound();
    const beforeColumnsY = pdfClient.getY();

    // Organization column
    // Setting bounds for the first column
    pdfClient.setRightBound(pageWidth / 2);

    regularText(receiptData.organization.name);
    regularText(`${receiptData.organization.street}`);
    if (receiptData.organization.street2) {
      regularText(`${receiptData.organization.street2}`);
    }
    regularText(`${receiptData.organization.city}, ${receiptData.organization.state} ${receiptData.organization.zip}`);

    const afterFirstColumn = pdfClient.getY();

    // Patient column
    // Setting Y to the start of the table
    pdfClient.setY(beforeColumnsY);

    // Setting new bounds for the second column
    pdfClient.setRightBound(initialRightBound);
    pdfClient.setLeftBound(pageWidth / 2);

    regularText(receiptData.patient.name);
    regularText(`${receiptData.patient.street}`);
    if (receiptData.patient.street2) {
      regularText(`${receiptData.patient.street2}`);
    }
    regularText(`${receiptData.patient.city}, ${receiptData.patient.state} ${receiptData.patient.zip}`);

    // Setting Y to the minimum so cursor will be at the bottom of the table
    if (afterFirstColumn < pdfClient.getY()) pdfClient.setY(afterFirstColumn);
    else pdfClient.setY(pdfClient.getY());

    pdfClient.setLeftBound(initialLeftBound);
  };

  const drawPaymentDetails = (): void => {
    const tableWidth = (pdfClient.getRightBound() - pdfClient.getLeftBound()) * 0.9;
    const columnWidth = tableWidth / 3;
    const initialLeftBound = pdfClient.getLeftBound();
    let totalAmount = 0;

    // Payments list
    receiptData.payments.forEach((payment, index) => {
      const paymentMethodText = payment.method === 'card' ? `card ending ${payment.last4}` : payment.method;
      totalAmount += payment.amount;

      pdfClient.setRightBound(initialLeftBound + columnWidth);
      pdfClient.drawText(`Payment ${index + 1}`, textStyles.inlineText);

      pdfClient.setLeftBound(initialLeftBound + columnWidth);
      pdfClient.setRightBound(initialLeftBound + columnWidth * 2);

      pdfClient.drawText(paymentMethodText, textStyles.inlineText);
      pdfClient.setLeftBound(initialLeftBound + columnWidth * 2);
      pdfClient.setRightBound(initialLeftBound + columnWidth * 3);

      regularText(`$${payment.amount}`);
      pdfClient.setLeftBound(initialLeftBound);
    });

    pdfClient.newLine(STANDARD_NEW_LINE);

    // Totals
    pdfClient.drawText(`Total Payments for date ${receiptData.receiptDate}`, textStyles.inlineText);
    pdfClient.setLeftBound(initialLeftBound + columnWidth * 2);
    regularText(`$${totalAmount}`);
    pdfClient.setLeftBound(initialLeftBound);
  };

  drawHeadline();
  regularText(`Receipt Date: ${receiptData.receiptDate}`);
  regularText(`Visit Date: ${receiptData.visitDate}`);
  pdfClient.newLine(STANDARD_NEW_LINE);
  drawOrganizationAndPatientDetails();
  pdfClient.newLine(STANDARD_NEW_LINE);
  drawBlockHeader('Payments Details');
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
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  const bucketName = 'patient-payment-receipts';
  const fileName = 'patient-payment-receipt.pdf';
  console.log('Creating base file url');
  const baseFileUrl = makeZ3Url({ secrets, bucketName, patientID: patientId, fileName });
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  return { title: fileName, uploadURL: 'baseFileUrl' };
}
