import { InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Appointment, Location, Patient, RelatedPerson } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { PageSizes } from 'pdf-lib';
import { formatDateToMDYWithTime, getAppointmentType, getFullName, standardizePhoneNumber } from 'utils';
import { createPdfClient, getPdfLogo, rgbNormalized } from '../../shared/pdf/pdf-utils';
import { ImageStyle, LineStyle, PdfClient, PdfClientStyles, TextStyle } from '../../shared/pdf/types';

export interface StatementPdfInput {
  patient: Patient;
  appointment: Appointment;
  itemizationResponse: InvoiceItemizationResponse;
  timezone: string;
  location?: Location;
  responsibleParty?: RelatedPerson | Patient;
}

const TITLE_COLOR = rgbNormalized(15, 52, 124);
const LABEL_COLOR = rgbNormalized(180, 180, 180);

export async function generatePdf(input: StatementPdfInput): Promise<Uint8Array> {
  const { patient, appointment, location, itemizationResponse, timezone, responsibleParty } = input;
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        top: 40,
        bottom: 40,
        right: 40,
        left: 40,
      },
    },
  };
  const pdfClient = await createPdfClient(pdfClientStyles);
  const rubikFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const rubikFontBold = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Bold.otf'));

  const textStyles: Record<string, TextStyle> = {
    title: {
      fontSize: 20,
      font: rubikFont,
      color: TITLE_COLOR,
      spacing: 17,
      side: 'right',
    },
    subtitle: {
      fontSize: 16,
      spacing: 8,
      font: rubikFont,
      color: TITLE_COLOR,
    },
    regular: {
      fontSize: 12,
      spacing: 1,
      font: rubikFont,
    },
    regularBold: {
      fontSize: 12,
      spacing: 1,
      font: rubikFontBold,
    },
    tableContent: {
      fontSize: 10,
      spacing: 1,
      font: rubikFont,
    },
    label: {
      fontSize: 12,
      spacing: 1,
      font: rubikFont,
      color: LABEL_COLOR,
    },
  };
  const tableRowSeparatorStyle: LineStyle = {
    thickness: 0.5,
    color: rgbNormalized(200, 200, 200),
    margin: {
      top: 8,
    },
  };

  const logoBuffer = await getPdfLogo();
  if (logoBuffer) {
    const logo = await pdfClient.embedImage(logoBuffer);
    const imgStyles: ImageStyle = {
      width: 110,
      height: 28,
    };
    pdfClient.drawImage(logo, imgStyles);
  }

  pdfClient.drawText('STATEMENT\n', textStyles.title);

  const { type: appointmentType } = getAppointmentType(appointment);
  const { date: appointmentDate, time: appointmentTime } = formatDateToMDYWithTime(appointment?.start, timezone) ?? {};
  const locationName = location?.name ?? '';

  pdfClient.drawText(`${appointmentType} | ${appointmentTime} | ${appointmentDate}\n`, textStyles.regular);
  pdfClient.drawText(locationName + '\n\n', textStyles.regular);

  const patientName = getFullName(patient) ?? '';
  const patientDob =
    (patient?.birthDate && DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')) ?? '';
  const patientMobile =
    standardizePhoneNumber(patient?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value) ??
    '';
  const patientEmail = patient?.telecom?.find((c) => c.system === 'email' && c.period?.end === undefined)?.value ?? '';

  pdfClient.drawText('Patient\n', textStyles.label);
  pdfClient.drawText(`${patientName}\n`, textStyles.regularBold);
  pdfClient.drawText(`DOB: ${patientDob}\n`, textStyles.regular);
  pdfClient.drawText(`${patientMobile} | ${patientEmail}\n\n`, textStyles.regular);

  if (responsibleParty) {
    const responsiblePartyAddress = responsibleParty?.address?.[0];
    const addressLine1 = responsiblePartyAddress?.line?.[0] ?? '';
    const addressLine2 = responsiblePartyAddress?.line?.[1] ?? '';
    const city = responsiblePartyAddress?.city ?? '';
    const state = responsiblePartyAddress?.state ?? '';
    const zip = responsiblePartyAddress?.postalCode ?? '';
    const address = [addressLine1, addressLine2, `${city}, ${state} ${zip}`].filter((s) => s.length > 0).join('\n');
    const phone =
      standardizePhoneNumber(
        responsibleParty?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value
      ) ?? '';
    const email =
      responsibleParty?.telecom?.find((c) => c.system === 'email' && c.period?.end === undefined)?.value ?? '';

    pdfClient.drawText('Responsible party\n', textStyles.label);
    pdfClient.drawText(getFullName(responsibleParty) + '\n', textStyles.regularBold);
    pdfClient.drawText(address + '\n', textStyles.regular);
    pdfClient.drawText(`${phone} | ${email}\n\n`, textStyles.regular);
  }

  pdfClient.drawText('Services provided\n', textStyles.subtitle);

  pdfClient.drawStartXPosSpecifiedText('Service', textStyles.tableContent, 0);
  pdfClient.drawStartXPosSpecifiedText('Price', textStyles.tableContent, 200);
  restoreY(pdfClient, () => {
    pdfClient.drawStartXPosSpecifiedText('Insurance\nPaid', textStyles.tableContent, 270);
  });
  restoreY(pdfClient, () => {
    pdfClient.drawStartXPosSpecifiedText('Patient\nResponsibility', textStyles.tableContent, 340);
  });
  restoreY(pdfClient, () => {
    pdfClient.drawStartXPosSpecifiedText('Patient\nPaid', textStyles.tableContent, 430);
  });
  pdfClient.drawStartXPosSpecifiedText('Balance\n\n', textStyles.tableContent, 500);

  for (const serviceLine of itemizationResponse.serviceLineItemization) {
    pdfClient.drawSeparatedLine(tableRowSeparatorStyle);
    pdfClient.drawStartXPosSpecifiedText(serviceLine.procedureCode, textStyles.tableContent, 0);
    pdfClient.drawStartXPosSpecifiedText(
      formatMoney(serviceLine.chargeAmountCents - serviceLine.insuranceAdjustments.totalAdjustmentCents),
      textStyles.tableContent,
      200
    );
    pdfClient.drawStartXPosSpecifiedText(
      formatMoney(serviceLine.insurancePayments.totalPaymentCents),
      textStyles.tableContent,
      270
    );
    pdfClient.drawStartXPosSpecifiedText(
      formatMoney(
        serviceLine.chargeAmountCents -
          serviceLine.insuranceAdjustments.totalAdjustmentCents -
          serviceLine.insurancePayments.totalPaymentCents
      ),
      textStyles.tableContent,
      340
    );
    pdfClient.drawStartXPosSpecifiedText(
      formatMoney(serviceLine.patientPayments.totalPaymentCents),
      textStyles.tableContent,
      430
    );
    pdfClient.drawStartXPosSpecifiedText(
      formatMoney(serviceLine.patientBalanceCents) + '\n',
      textStyles.tableContent,
      500
    );
  }

  pdfClient.drawText('\n\n', textStyles.regular);
  pdfClient.drawText(`Remaining Patient Balance: ${formatMoney(itemizationResponse.patientBalanceCents)}`, {
    ...textStyles.regularBold,
    side: 'right',
  });

  return pdfClient.save();
}

function restoreY(pdfClient: PdfClient, draw: () => void): void {
  const y = pdfClient.getY();
  draw();
  pdfClient.setY(y);
}

function formatMoney(cents: number): string {
  return '$' + cents / 100 + '.' + String(cents % 100).padStart(2, '0');
}
