import { PDFDocument, StandardFonts, PageSizes } from 'pdf-lib';
import { Patient } from 'fhir/r4';
import { DateTime } from 'luxon';

export function parseFiletype(fileUrl: string): string {
  const filetype = fileUrl.match(/\w+$/)?.[0];
  if (filetype) {
    return filetype;
  } else {
    throw new Error('Failed to parse filetype from url');
  }
}

export async function drawCardsPDF(
  cardFrontBytes: ArrayBuffer | undefined,
  cardFrontFiletype: string | undefined,
  cardBackBytes: ArrayBuffer | undefined,
  cardBackFiletype: string | undefined,
  patient: Patient,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const [pageWidth, pageHeight] = PageSizes.A4;
  page.setSize(pageWidth, pageHeight);

  const xMargin = 63;
  const yMargin = 69;
  const spacing = 14;
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const [maxCardWidth, maxCardHeight] = [pageWidth - xMargin * 2, (pageHeight - yMargin * 2 - spacing * 3) / 2];

  const textStyles = {
    x: xMargin,
    y: pageHeight - yMargin,
    size: 14,
    font: helveticaFont,
  };

  const drawImage = async (imageBytes: ArrayBuffer, fileType: string | undefined, yOffset: number): Promise<number> => {
    let image;

    switch (fileType) {
      case 'png':
        image = await pdfDoc.embedPng(imageBytes);
        break;
      case 'jpg':
      case 'jpeg':
        image = await pdfDoc.embedJpg(imageBytes);
        break;
      default:
        throw new Error('Unsupported file type. File type must be one of: "png", "jpg", "jpeg"');
    }

    const scaledImage = image.scaleToFit(maxCardWidth, maxCardHeight);

    page.drawImage(image, {
      x: xMargin,
      y: yOffset - scaledImage.height,
      height: scaledImage.height,
      width: scaledImage.width,
    });

    return scaledImage.height;
  };

  // Draw the PDF
  page.drawText(
    `Patient: ${patient.name?.[0].given?.[0] || ''} ${patient.name?.[0].family || ''}, DOB: ${DateTime.fromISO(
      patient?.birthDate || '',
    ).toLocaleString(DateTime.DATE_SHORT)}`,
    textStyles,
  );

  let cardFrontHeight;
  if (cardFrontBytes) {
    cardFrontHeight = await drawImage(cardFrontBytes, cardFrontFiletype, textStyles.y - spacing * 2);
  }

  if (cardBackBytes) {
    const yOffset =
      cardFrontBytes && cardFrontHeight
        ? pageHeight - cardFrontHeight - yMargin - spacing * 4
        : textStyles.y - spacing * 2;
    await drawImage(cardBackBytes, cardBackFiletype, yOffset);
  }

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  // fs.writeFileSync(`./cards-temp.pdf`, pdfBytes);
  return pdfBytes;
}
