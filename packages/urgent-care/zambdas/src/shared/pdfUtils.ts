import { PDFDocument, PDFPage, StandardFonts, rgb, Color, PageSizes } from 'pdf-lib';
import fs from 'fs';
import { formatDateTimeToLocaleString } from './dateUtils';
import { Patient } from 'fhir/r4';
import { ConsentSigner } from '../types';
import { createConsentResource, createDocumentReference, getLocationResource } from './fhir';
import { FhirClient } from '@zapehr/sdk';
import { Secrets, SecretsKeys, getSecret } from 'utils';

export async function drawConsentFormsPDF(
  patient: Patient,
  consentSigner: ConsentSigner,
  dateTime: string,
  timezone: string,
  ipAddress: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.setSize(PageSizes.A4[0], PageSizes.A4[1]);

  const { height } = page.getSize();
  const xMargin = 63;
  const yMargin = 69;
  const spacing = 14;
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const dingbatFont = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);

  const rbgNormalized = (r: number, g: number, b: number): Color => rgb(r / 255, g / 255, b / 255);

  const styles = {
    header: {
      font: timesRomanFont,
      fontSize: spacing,
      yPos: height - yMargin,
    },
    forms: {
      font: helveticaFont,
      fontSize: 10,
      yPos: height - yMargin - spacing,
    },
    detail: {
      font: helveticaFont,
      fontSize: 10,
      yPos: height - yMargin - spacing * 4,
    },
  };

  const headerText = (text: string): void =>
    page.drawText(text, {
      x: xMargin,
      y: styles.header.yPos,
      size: styles.header.fontSize,
      font: styles.header.font,
    });

  const formsText = (text: string, yOffset: number): void =>
    page.drawText(text, {
      x: 105,
      y: styles.forms.yPos - yOffset,
      size: styles.forms.fontSize,
      font: styles.forms.font,
    });

  const drawCheckmark = (yOffset: number): void =>
    page.drawText('\u2713', {
      x: 87,
      y: styles.forms.yPos - yOffset,
      font: dingbatFont,
      size: styles.forms.fontSize,
    });

  const drawDetail = (detail: { label: string; value: string }, drawHR: boolean, yOffset: number): void => {
    const yPos = styles.detail.yPos - yOffset;
    const horizontalRuleWidth = 470;
    const fontStyles = {
      font: styles.detail.font,
      size: styles.detail.fontSize,
    };

    const alignRight = (text: string): number => {
      const textWidth = fontStyles.font.widthOfTextAtSize(text, fontStyles.size);
      return xMargin + horizontalRuleWidth - textWidth;
    };

    page.drawText(detail.label, {
      ...fontStyles,
      x: xMargin,
      y: yPos,
    });
    page.drawText(detail.value, {
      ...fontStyles,
      x: alignRight(detail.value),
      y: yPos,
    });
    if (drawHR) {
      page.drawLine({
        color: rbgNormalized(227, 230, 239),
        start: { x: xMargin, y: yPos - spacing / 2 },
        end: { x: xMargin + horizontalRuleWidth, y: yPos - spacing / 2 },
      });
    }
  };

  // Header
  headerText(`${patient.name?.[0].family}, ${patient.name?.[0].given?.[0]}`);

  drawCheckmark(styles.forms.fontSize);
  formsText('Consent to Treat and Guarantee of Payment', styles.forms.fontSize);
  drawCheckmark(styles.forms.fontSize * 2);
  formsText('HIPAA Acknowledgement', styles.forms.fontSize * 2);

  // Forms details
  const details = [
    { label: 'Patient lastname', value: patient.name?.[0].family || '' },
    { label: 'Patient firstname', value: patient.name?.[0].given?.[0] || '' },
    { label: 'Date of birth', value: formatDateTimeToLocaleString(patient?.birthDate || '', 'date') },
    { label: 'Signature', value: consentSigner.signature },
    { label: 'Signed by', value: consentSigner.fullName },
    {
      label: 'Relationship to the patient',
      value: consentSigner.relationship,
    },
    { label: 'Date and time', value: formatDateTimeToLocaleString(dateTime, 'datetime', timezone) },
    {
      label: 'IP',
      value: ipAddress,
    },
  ];

  details.forEach((detail, index, arr) => {
    drawDetail(detail, index === arr.length - 1 ? false : true, index * spacing * 1.5);
  });

  // ZapEHR ID
  if (patient.id) {
    page.drawText(`ZapEHR ID: ${patient.id}`, {
      font: styles.detail.font,
      size: styles.detail.fontSize,
      x: xMargin,
      y: yMargin - styles.detail.fontSize,
    });
  }

  // Append consent forms
  const appendPdf = async (filename: string): Promise<void> => {
    const document = await PDFDocument.load(fs.readFileSync(filename));
    const copiedPages = await pdfDoc.copyPages(document, document.getPageIndices());
    copiedPages.forEach((page: PDFPage) => pdfDoc.addPage(page));
  };

  // TODO: Add relevant pdf extensions
  // await appendPdf('example file for guarantee of payment pdf');
  // await appendPdf('example file for HIPAA acknowledgment file pdf');

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  // fs.writeFileSync(`./consent-forms-${patient.id}.pdf`, pdfBytes);

  return pdfBytes;
}

// Create consent PDF, DocumentReference, and Consent resource
export async function createConsentItems(
  dateTime: string,
  patient: Patient,
  consentSigner: ConsentSigner,
  appointmentID: string,
  locationID: string,
  ipAddress: string,
  fhirClient: FhirClient,
  token: string,
  secrets: Secrets | null,
): Promise<void> {
  console.log('Creating consent pdf');

  if (!patient.id) {
    throw new Error('No patient id found for consent items');
  }

  // Get timezone from location
  const locationResource = await getLocationResource(locationID, fhirClient);
  if (!locationResource) {
    throw new Error('No location found');
  }

  const timezone = locationResource.extension?.find(
    (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
  )?.valueString;
  if (!timezone) {
    throw new Error('No timezone found');
  }

  // Draw consent PDF
  const pdfBytes = await drawConsentFormsPDF(patient, consentSigner, dateTime, timezone, ipAddress).catch((error) => {
    throw new Error(`Failed to create consent forms PDF: ${error.message}`);
  });

  // Upload consent PDF to z3
  // const z3Client = createZ3Client(token, secrets);
  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const filename = `${patient.id}/${Date.now()}-consent-forms.pdf`;
  const bucket = `${environment}-consent-forms`;
  const fileURL = `${getSecret(SecretsKeys.PROJECT_API, secrets)}/z3/${bucket}/${filename}`;
  // await z3Client.uploadObject(bucket, filename, pdfBytes).catch((error) => {
  //   throw new Error(`Failed to upload consent PDF to z3: ${JSON.stringify(error)}`);
  // });

  const presignedURLRequest = await fetch(fileURL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'upload' }),
  });
  const presignedURLResponse = await presignedURLRequest.json();

  if (!presignedURLRequest.ok) {
    console.log(presignedURLResponse);
    throw new Error('Failed to get presigned url for consent PDF upload');
  }

  const uploadRequest = await fetch(presignedURLResponse.signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: pdfBytes,
  });

  if (!uploadRequest.ok) {
    throw new Error('Failed to upload consent PDF');
  }

  // Create DocumentReference for consent pdf
  const consentDocumentReference = await createDocumentReference(
    fileURL,
    {
      coding: [
        {
          system: 'http://loinc.org',
          code: '59284-0',
          display: 'Consent Document',
        },
      ],
      text: 'Consent forms',
    },
    'application/pdf',
    'Consent forms',
    dateTime,
    {
      subject: {
        reference: `Patient/${patient.id}`,
      },
      context: {
        related: [
          {
            reference: `Appointment/${appointmentID}`,
          },
        ],
      },
    },
    fhirClient,
  );

  if (!consentDocumentReference.id) {
    throw new Error('No consent document reference id found');
  }

  // Create FHIR Consent resource
  await createConsentResource(patient.id, consentDocumentReference.id, dateTime, fhirClient);
}
