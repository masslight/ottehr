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
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../stripeIntegration';
import { STANDARD_NEW_LINE } from './pdf-consts';
import { createPdfClient, PdfInfo, rgbNormalized, savePdfLocally } from './pdf-utils';
import { ImageStyle, PdfClientStyles, TextStyle } from './types';

export async function createPatientPaymentReceiptPdf(
  encounterId: string,
  patientId: string,
  secrets: Secrets | null,
  oystehrToken: string
): Promise<any> {
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
  const response = await createReplaceReceiptOnZ3(receiptPdf, receiptData.patient.id, secrets, oystehrToken);
  return response;
}

interface PaymentData {
  amount: number;
  method: CashOrCardPayment['paymentMethod'];
  last4?: string;
}

interface PatientPaymentReceiptData {
  receiptDate: string;
  visitDate: string;
  payments: PaymentData[];
  organization: {
    name: string;
    street: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
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
    // todo i have to add brand of card and change text to 'Card ending 1111'

    return {
      amount: paymentNotice.amount.value ?? -1,
      method: method,
      last4,
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
      street2: organizationAddress?.line?.[1] ?? '',
      city: organizationAddress?.city ?? '',
      state: organizationAddress?.state ?? '',
      zip: organizationAddress?.postalCode ?? '',
      phone: '??',
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
  const RubikFontBold = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Bold.otf'));
  const ottehrLogo = await pdfClient.embedImage(fs.readFileSync('./assets/ottehrLogo.png'));

  const textStyles: Record<string, TextStyle> = {
    header: {
      fontSize: 20,
      font: RubikFontBold,
      spacing: 17,
      side: 'right',
      newLineAfter: true,
    },
    blockHeader: {
      fontSize: 18,
      spacing: 8,
      font: RubikFont,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    blockSubHeader: {
      fontSize: 16,
      spacing: 1,
      font: RubikFontBold,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    fieldText: {
      fontSize: 16,
      spacing: 6,
      font: RubikFont,
      side: 'right',
      newLineAfter: true,
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

  const drawBlockSubHeader = (text: string): void => {
    pdfClient.drawText(text, textStyles.blockSubHeader);
  };

  const regularText = (text?: string, alternativeText?: string): void => {
    if (text) pdfClient.drawText(text, textStyles.text);
    else if (alternativeText) pdfClient.drawText(alternativeText, textStyles.alternativeRegularText);
  };

  const drawHeadline = (): void => {
    const imgStyles: ImageStyle = {
      width: 190,
      height: 47,
    };
    pdfClient.drawImage(ottehrLogo, imgStyles);
    pdfClient.setY(pdfClient.getY() - imgStyles.height); // new line after image
  };

  const drawOrganizationAndPatientDetails = (): void => {
    const pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
    const initialRightBound = pdfClient.getRightBound();
    const initialLeftBound = pdfClient.getLeftBound();
    const beforeColumnsY = pdfClient.getY();

    // todo here i wanna put patient address in order:
    //  Street,
    //  Street2,
    //  City, State Zip

    // Organization column
    pdfClient.setRightBound(pageWidth / 2);
    pdfClient.drawText(receiptData.organization.name, textStyles.text);
    pdfClient.drawText(`${receiptData.organization.street}`, textStyles.text);
    if (receiptData.organization.street2) {
      pdfClient.drawText(`${receiptData.organization.street2}`, textStyles.text);
    }
    pdfClient.drawText(
      `${receiptData.organization.city}, ${receiptData.organization.state} ${receiptData.organization.zip}`,
      textStyles.text
    );
    // pdfClient.drawTextSequential(`${receiptData.organization.street2}\n`, textStyles.text, {
    //   leftBound: pdfClient.getLeftBound(),
    //   rightBound: pageWidth / 2,
    // });
    // pdfClient.drawTextSequential(
    //   `${receiptData.organization.city}, ${receiptData.organization.state} ${receiptData.organization.zip}`,
    //   textStyles.text,
    //   {
    //     leftBound: pdfClient.getLeftBound(),
    //     rightBound: pageWidth / 2,
    //   }
    // );

    const afterFirstColumn = pdfClient.getY();
    // Patient column
    pdfClient.setY(beforeColumnsY);

    pdfClient.setRightBound(initialRightBound);
    pdfClient.setLeftBound(pageWidth / 2);

    pdfClient.drawText(receiptData.patient.name, textStyles.text);
    pdfClient.drawText(`${receiptData.patient.street}`, textStyles.text);
    if (receiptData.patient.street2) {
      pdfClient.drawText(`${receiptData.patient.street2}`, textStyles.text);
    }
    pdfClient.drawText(
      `${receiptData.patient.city}, ${receiptData.patient.state} ${receiptData.patient.zip}`,
      textStyles.text
    );

    // if (receiptData.patient.street2) {
    //   pdfClient.drawTextSequential(`${receiptData.patient.street2}\n`, textStyles.text, {
    //     leftBound: pdfClient.getLeftBound() + pageWidth / 2,
    //     rightBound: pageWidth / 2,
    //   });
    // }
    // pdfClient.drawTextSequential(
    //   `${receiptData.patient.city}, ${receiptData.patient.state} ${receiptData.patient.zip}`,
    //   textStyles.text,
    //   {
    //     leftBound: pdfClient.getLeftBound() + pageWidth / 2,
    //     rightBound: pageWidth / 2,
    //   }
    // );

    // Setting Y to the minimum of the two columns Y positions
    if (afterFirstColumn < pdfClient.getY()) {
      pdfClient.setY(afterFirstColumn);
    } else {
      pdfClient.setY(pdfClient.getY());
    }
    pdfClient.setLeftBound(initialLeftBound);
  };

  const drawPaymentDetails = (): void => {
    const columnGap = 10;
    const tableWidth = (pdfClient.getRightBound() - pdfClient.getLeftBound()) * 0.6;
    const columnWidth = tableWidth / 3 - columnGap;
    const leftBound = pdfClient.getLeftBound();
    let totalAmount = 0;

    receiptData.payments.forEach((payment, index) => {
      const paymentMethod = payment.method;
      const last4 = payment.last4;
      const amount = payment.amount;
      const paymentMethodText = paymentMethod === 'card' ? `Card ending ${last4}` : paymentMethod;
      const amountText = `$${amount}`;
      totalAmount += amount;
      pdfClient.drawVariableWidthColumns(
        [
          {
            content: `Payment ${index + 1}`,
            textStyle: textStyles.text,
            startXPos: leftBound,
            width: columnWidth,
          },
          {
            content: paymentMethodText,
            textStyle: textStyles.text,
            startXPos: leftBound + columnWidth + columnGap,
            width: columnWidth,
          },
          {
            content: amountText,
            textStyle: textStyles.text,
            startXPos: leftBound + (columnWidth + columnGap) * 2,
            width: columnWidth,
          },
        ],
        pdfClient.getY(),
        pdfClient.getCurrentPageIndex()
      );
    });

    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient.drawVariableWidthColumns(
      [
        {
          content: `Total Payments for date ${receiptData.receiptDate}`,
          textStyle: textStyles.text,
          startXPos: leftBound,
          width: columnWidth * 2,
        },
        {
          content: `$${totalAmount}`,
          textStyle: textStyles.text,
          startXPos: leftBound + (columnWidth + columnGap) * 2,
          width: columnWidth,
        },
      ],
      pdfClient.getY(),
      pdfClient.getCurrentPageIndex()
    );
  };

  drawHeadline();
  drawBlockHeader('Receipt');
  regularText(`Receipt Date: ${receiptData.receiptDate}`);
  regularText(`Visit Date: ${receiptData.visitDate}`);
  pdfClient.newLine(STANDARD_NEW_LINE);
  drawOrganizationAndPatientDetails();
  pdfClient.newLine(STANDARD_NEW_LINE);
  drawBlockSubHeader('Payments Details');
  drawPaymentDetails();

  return await pdfClient.save();
}

async function createReplaceReceiptOnZ3(
  pdfBytes: Uint8Array,
  patientId: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('secrets: ', secrets);
  console.log('token: ', token);
  // const bucketName = 'receipts';
  const fileName = 'receipt.pdf';
  console.log('Creating base file url');
  console.log('patientId: ', patientId);
  // const baseFileUrl = makeZ3Url({ secrets, bucketName, patientID: patientId, fileName });
  console.log('Uploading file to bucket');
  // await uploadPDF(pdfBytes, token, baseFileUrl, patientId).catch((error) => {
  //   throw new Error('failed uploading pdf to z3: ' + error.message);
  // });

  // for testing
  savePdfLocally(pdfBytes);
  return { title: fileName, uploadURL: 'baseFileUrl' };
}
