import fontkit from '@pdf-lib/fontkit';
import { remove as removeDiacritics } from 'diacritics';
import { Patient } from 'fhir/r4b';
import fs from 'fs';
import { Color, PDFDocument, PDFFont, PDFPage, PageSizes, StandardFonts, rgb } from 'pdf-lib';
import { ConsentSigner, formatDateTimeToLocaleString } from 'utils';
import { Secrets, getSecret, triggerSlackAlarm } from 'zambda-utils';

type PdfInfo = { uploadURL: string; copyFromPath: string; formTitle: string; resourceTitle: string };
type SectionDetail = { label: string; value: string; valueFont?: PDFFont };
type Section = { header: string; body: SectionDetail[] };
enum ConsentDetailLabel {
  lastName = 'Patient lastname',
  firstName = 'Patient firstname',
  dob = 'Date of birth',
  signedBy = 'Signed by',
  signature = 'Signature',
  dateSigned = 'Date signed',
  relationship = "Signer's relationship to patient",
}

interface DrawFirstPageParams {
  patient: Patient;
  consentSigner: ConsentSigner;
  dateTime: string;
  ipAddress: string;
  pdfDoc: PDFDocument;
  pdfInfo: PdfInfo;
  numPages: number;
  secrets: Secrets | null;
  timezone?: string;
  facilityName?: string;
}

// https://www.fileformat.info/info/unicode/category/Zs/list.htm
const UNICODE_SPACE_SEPARATORS = [
  '\u0020',
  '\u00A0',
  '\u1680',
  '\u2000',
  '\u2001',
  '\u2002',
  '\u2003',
  '\u2004',
  '\u2005',
  '\u2006',
  '\u2007',
  '\u2008',
  '\u2009',
  '\u200A',
  '\u202F',
  '\u205F',
  '\u3000',
];

async function drawFirstPage({
  patient,
  consentSigner,
  dateTime,
  ipAddress,
  pdfDoc,
  pdfInfo,
  numPages,
  secrets,
  timezone,
  facilityName,
}: DrawFirstPageParams): Promise<void> {
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage();
  page.setSize(PageSizes.A4[0], PageSizes.A4[1]);
  const { width, height } = page.getSize();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const dancingSignatureFont = await pdfDoc.embedFont(fs.readFileSync('./DancingScript-Regular.otf'));
  const helveticaSupportedChars = helveticaFont.getCharacterSet();
  const scriptSupportedChars = dancingSignatureFont.getCharacterSet();
  const rbgNormalized = (r: number, g: number, b: number): Color => rgb(r / 255, g / 255, b / 255);
  const styles = {
    header: {
      font: timesRomanFont,
      fontSize: 16,
    },
    detail: {
      font: helveticaFont,
      fontSize: 10,
      horizontalRuleWidth: 470,
      horizontalRuleThickness: 1,
    },
    spacing: {
      detail: 7,
      header: 10,
      section: 28,
      horizontalRule: 7,
    },
    margin: {
      x: 63,
      y: 69,
    },
  };

  const drawHeader = (text: string, yPos: number): void => {
    page.drawText(text, {
      x: styles.margin.x,
      y: yPos,
      size: styles.header.fontSize,
      font: styles.header.font,
    });
  };

  const drawDetail = async (detail: SectionDetail, drawHR: boolean, yPos: number): Promise<void> => {
    const alignRight = (text: string, font: PDFFont): number => {
      const textWidth = font.widthOfTextAtSize(text, styles.detail.fontSize);
      return styles.margin.x + styles.detail.horizontalRuleWidth - textWidth;
    };

    page.drawText(detail.label, {
      font: styles.detail.font,
      size: styles.detail.fontSize,
      x: styles.margin.x,
      y: yPos,
    });

    const valueFont = detail.valueFont ?? styles.detail.font;
    let supportedChars;

    switch (valueFont) {
      case helveticaFont:
        supportedChars = helveticaSupportedChars;
        break;
      case dancingSignatureFont:
        supportedChars = scriptSupportedChars;
        break;
      default:
        throw new Error(`Failed to get supported character set for ${valueFont.name}`);
    }

    // Replace unsupported characters
    // https://stackoverflow.com/a/18169122
    if (Object.values<string>(ConsentDetailLabel).includes(detail.label)) {
      // spread the string to invoke its symbol iterator and avoid surrogate pairs
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt#looping_with_codepointat
      const detailValueChars = [...detail.value.replace(/\s/g, ' ')]; // replace ascii space separators with single space
      const unknownChar = '?';
      let numOutOfRange = 0;
      const unsupportedCodePoints: string[] = [];
      // console.log('og: ', detail.value);

      for (let i = 0; i < detailValueChars.length; i++) {
        const codePoint = detailValueChars[i].codePointAt(0);
        if (codePoint === undefined) {
          detailValueChars[i] = unknownChar;
          numOutOfRange++;
          console.warn('no code point found for character: ', detailValueChars[i]);
        } else if (!supportedChars.includes(codePoint)) {
          // Replace unsupported diacritics and cyrillic characters with thier english equivalent
          let newChar = removeDiacritics(detailValueChars[i]);
          const newCharCodePoint = [...newChar][0].codePointAt(0);
          if (newCharCodePoint === undefined) {
            newChar = unknownChar;
            numOutOfRange++;
            console.warn('no code point found for character: ', newChar);
          } else if (!supportedChars.includes(newCharCodePoint)) {
            // Replace unsupported unicode space separators with single space
            // Anything else is a valid unicode character but not supported by pdf-lib so replace with '?'
            // e.g. \u0456 should be replaced with '?'
            newChar = UNICODE_SPACE_SEPARATORS.includes(newChar) ? ' ' : unknownChar;
            // Convert decimal code point to "U+xxxx" format
            unsupportedCodePoints.push(`U+${newCharCodePoint.toString(16).padStart(4, '0')}`);
          }
          detailValueChars[i] = newChar;
        }
      }

      detail.value = detailValueChars.join('');
      // console.log('replaced: ', detail.value);

      // Send slack alert if anything was replaced with '?'
      if (numOutOfRange || unsupportedCodePoints.length) {
        const environment = getSecret('ENVIRONMENT', secrets);
        const errMessage = `[${environment}]${
          unsupportedCodePoints.length
            ? ` Found unsupported characters in consent PDF with code points ${unsupportedCodePoints.join(', ')}.`
            : ''
        }${numOutOfRange ? ` Found ${numOutOfRange} characters outside of unicode code point range.` : ''}`;
        console.warn(errMessage);
        await triggerSlackAlarm(errMessage, secrets);
      }
    }

    // console.log(
    //   'about to draw',
    //   detail.value,
    //   [...detail.value].map((char) => char.codePointAt(0))
    // );
    page.drawText(detail.value, {
      font: valueFont,
      size: styles.detail.fontSize,
      x: alignRight(detail.value, valueFont),
      y: yPos,
    });

    if (drawHR) {
      page.drawLine({
        color: rbgNormalized(227, 230, 239),
        thickness: styles.detail.horizontalRuleThickness,
        start: { x: styles.margin.x, y: yPos - styles.spacing.horizontalRule },
        end: { x: styles.margin.x + styles.detail.horizontalRuleWidth, y: yPos - styles.spacing.horizontalRule },
      });
    }
  };

  const patientDetails: SectionDetail[] = [
    { label: ConsentDetailLabel.firstName, value: patient.name?.[0].given?.[0].trim() || '' },
    { label: ConsentDetailLabel.lastName, value: patient.name?.[0].family?.trim() || '' },
    { label: ConsentDetailLabel.dob, value: formatDateTimeToLocaleString(patient?.birthDate || '', 'date') },
    { label: ConsentDetailLabel.signedBy, value: consentSigner.fullName.trim() },
    { label: ConsentDetailLabel.signature, value: consentSigner.signature.trim(), valueFont: dancingSignatureFont },
    { label: ConsentDetailLabel.dateSigned, value: formatDateTimeToLocaleString(dateTime, 'datetime', timezone) },
    { label: ConsentDetailLabel.relationship, value: consentSigner.relationship },
  ];

  const additionalDetails: SectionDetail[] = [
    { label: 'Form title', value: pdfInfo.formTitle },
    { label: 'Page count', value: numPages.toString() },
  ];
  if (facilityName) {
    additionalDetails.push({ label: 'Facility name', value: facilityName });
  }
  additionalDetails.push({ label: 'IP address', value: ipAddress });

  const sections: Section[] = [
    { header: 'Patient Details', body: patientDetails },
    { header: 'Additional Details', body: additionalDetails },
  ];

  const headerTextHeight = styles.header.font.heightAtSize(styles.header.fontSize);
  const detailTextHeight = styles.detail.font.heightAtSize(styles.detail.fontSize);

  // Start at the top of the page then move down as elements are added to the PDF.
  let currYPos = height - styles.margin.y; // top of page. Content starts after this point

  // add Ottehr logo at the top of the PDF
  const imgPath = './ottehrLogo.png';
  const imgBytes = fs.readFileSync(imgPath);
  const img = await pdfDoc.embedPng(imgBytes);
  const imgDimensions = img.scale(0.3);
  currYPos -= imgDimensions.height / 2;
  page.drawImage(img, {
    x: (width - imgDimensions.width) / 2, // center image along x-axis
    y: currYPos,
    width: imgDimensions.width,
    height: imgDimensions.height,
  });

  currYPos -= imgDimensions.height / 2; // space after image

  // add all sections to PDF
  let sIndex = 0;
  let dIndex = 0;
  for (const section of sections) {
    drawHeader(section.header, currYPos);
    currYPos -= headerTextHeight + styles.spacing.header; // space between header and first detail
    for (const detail of section.body) {
      await drawDetail(detail, dIndex < section.body.length - 1, currYPos);

      currYPos -= detailTextHeight; // space between details
      if (dIndex < section.body.length - 1) {
        // additional space between details, except for the last detail in dArr
        currYPos -= styles.detail.horizontalRuleThickness + styles.spacing.horizontalRule + styles.spacing.detail;
        dIndex++;
      }
    }

    if (sIndex < sections.length - 1) {
      currYPos -= styles.spacing.section; // space before next section header
      sIndex++;
    }

    // reset detail index after each section
    dIndex = 0;
  }

  // ZapEHR ID
  if (patient.id) {
    page.drawText(`ZapEHR ID: ${patient.id}`, {
      font: styles.detail.font,
      size: styles.detail.fontSize,
      x: styles.margin.x,
      y: styles.margin.y - detailTextHeight,
    });
  }
}

export async function createPdfBytes(
  patient: Patient,
  consentSigner: ConsentSigner,
  dateTime: string,
  ipAddress: string,
  pdfInfo: PdfInfo,
  secrets: Secrets | null,
  timezone?: string,
  facilityName?: string
): Promise<Uint8Array> {
  console.log('running PDFDocument.create()', JSON.stringify(pdfInfo));
  const newPdf = await PDFDocument.create();
  console.log('running PDFDocument.load');
  const document = await PDFDocument.load(fs.readFileSync(pdfInfo.copyFromPath));
  console.log('drawing pdf page', JSON.stringify(newPdf));
  console.log(
    'drawing pdf page',
    JSON.stringify(newPdf),
    patient.id,
    JSON.stringify(consentSigner),
    dateTime,
    ipAddress,
    facilityName
  );
  await drawFirstPage({
    patient,
    consentSigner,
    dateTime,
    ipAddress,
    pdfDoc: newPdf,
    pdfInfo,
    numPages: document.getPageCount(),
    secrets,
    timezone,
    facilityName,
  });
  console.log('copying pages');
  const copiedPages = await newPdf.copyPages(document, document.getPageIndices());
  copiedPages.forEach((page: PDFPage) => newPdf.addPage(page));
  console.log('running newPdf.save()');
  const pdfBytes = await newPdf.save();
  return pdfBytes;
}
