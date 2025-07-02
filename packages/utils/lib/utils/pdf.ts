import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  PageSizes,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  RotationTypes,
  scale,
  StandardFonts,
  translate,
} from 'pdf-lib';
// import fs from 'fs';

// Get the image's EXIF orientation
// https://github.com/Hopding/pdf-lib/issues/1284
// https://stackoverflow.com/a/32490603
// Returns either the image orientation or -1 if none found
function getImageOrientation(file: ArrayBuffer): number {
  const view = new DataView(file);

  const length = view.byteLength;
  let offset = 2;

  while (offset < length) {
    if (view.getUint16(offset + 2, false) <= 8) return -1;
    const marker = view.getUint16(offset, false);
    offset += 2;

    // If EXIF buffer segment exists find the orientation
    if (marker == 0xffe1) {
      if (view.getUint32((offset += 2), false) != 0x45786966) {
        return -1;
      }

      const little = view.getUint16((offset += 6), false) == 0x4949;
      offset += view.getUint32(offset + 4, little);
      const tags = view.getUint16(offset, little);
      offset += 2;
      for (let i = 0; i < tags; i++) {
        if (view.getUint16(offset + i * 12, little) == 0x0112) {
          return view.getUint16(offset + i * 12 + 8, little);
        }
      }
    } else if ((marker & 0xff00) != 0xff00) {
      break;
    } else {
      offset += view.getUint16(offset, false);
    }
  }
  return -1;
}

// Get rotation in degrees from EXIF orientation
// https://sirv.com/help/articles/rotate-photos-to-be-upright/#exif-orientation-values
// x-mirrored: the image is flipped horizontallly
// y-mirrored: the image is flipped vertically
function getOrientationCorrection(orientation: number): { degrees: number; mirrored?: 'x' | 'y' } {
  switch (orientation) {
    case 2:
      return { degrees: 0, mirrored: 'x' };
    case 3:
      return { degrees: -180 };
    case 4:
      return { degrees: 180, mirrored: 'x' };
    case 5:
      return { degrees: 90, mirrored: 'y' };
    case 6:
      return { degrees: -90 };
    case 7:
      return { degrees: -90, mirrored: 'y' };
    case 8:
      return { degrees: 90 };
    default:
      return { degrees: 0 };
  }
}

export async function drawCardsPDF(
  cardFrontBytes: ArrayBuffer | undefined,
  cardFrontFiletype: string | undefined,
  cardBackBytes: ArrayBuffer | undefined,
  cardBackFiletype: string | undefined,
  patient: Patient
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('drawCardsPDF promise rejected. Timed out after 2.5s.'));
    }, 2500);

    const wrappedDraw = async (): Promise<void> => {
      try {
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

        const drawImage = async (
          imageBytes: ArrayBuffer,
          fileType: string | undefined,
          yOffset: number
        ): Promise<number> => {
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
              throw new Error(`Unsupported file type ${fileType}. File type must be one of: "png", "jpg", "jpeg"`);
          }

          const exifOrientation = getImageOrientation(imageBytes);
          const orientationCorrection = getOrientationCorrection(exifOrientation);

          let scaledImage, correctedWidth, correctedHeight;
          switch (exifOrientation) {
            case 5:
            case 6:
            case 7:
            case 8:
              // The uploaded image is rotated +/- 90 degrees
              scaledImage = image.scaleToFit(maxCardHeight, maxCardWidth);
              correctedWidth = scaledImage.height;
              correctedHeight = scaledImage.width;
              break;
            default:
              scaledImage = image.scaleToFit(maxCardWidth, maxCardHeight);
              correctedWidth = scaledImage.width;
              correctedHeight = scaledImage.height;
          }

          // Correct mirrored images
          // https://github.com/Hopding/pdf-lib/issues/183#issuecomment-569138703
          if (orientationCorrection.mirrored === 'x') {
            // scale - flips the image horizontally but keeps it in the same quadrant
            // translate - moves the coordinate system origin to the bottom right and flips the direction of the x-axis
            page.pushOperators(pushGraphicsState(), scale(-1, 1), translate(-pageWidth, 0));
          } else if (orientationCorrection.mirrored === 'y') {
            // scale - flips the image vertically but keeps it in the same quadrant
            // translate - moves the coordinate system origin to the top left and flips the direction of the y-axis
            page.pushOperators(pushGraphicsState(), scale(1, -1), translate(0, -pageHeight));
          }

          // Get x, y offset to shift corrected image
          let xShift, yShift;
          switch (exifOrientation) {
            case 2:
              xShift = pageWidth - xMargin - correctedWidth;
              yShift = yOffset - correctedHeight;
              break;
            case 3:
              xShift = xMargin + correctedWidth;
              yShift = yOffset;
              break;
            case 4:
              xShift = pageWidth - xMargin;
              yShift = yOffset;
              break;
            case 5:
              xShift = xMargin + correctedWidth;
              yShift = pageHeight - yOffset;
              break;
            case 6:
              xShift = xMargin;
              yShift = yOffset;
              break;
            case 7:
              xShift = xMargin;
              yShift = pageHeight - yOffset + correctedHeight;
              break;
            case 8:
              xShift = xMargin + correctedWidth;
              yShift = yOffset - correctedHeight;
              break;
            default:
              xShift = xMargin;
              yShift = yOffset - correctedHeight;
          }

          page.drawImage(image, {
            x: xShift,
            y: yShift,
            height: scaledImage.height,
            width: scaledImage.width,
            rotate: { angle: orientationCorrection.degrees, type: RotationTypes.Degrees },
          });

          orientationCorrection.mirrored && page.pushOperators(popGraphicsState());

          return correctedHeight;
        };

        // Draw the PDF
        page.drawText(
          `Patient: ${patient.name?.[0].given?.[0] || ''} ${patient.name?.[0].family || ''}, DOB: ${DateTime.fromISO(
            patient?.birthDate || ''
          ).toLocaleString(DateTime.DATE_SHORT)}`,
          textStyles
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
        return resolve(pdfBytes);
      } catch (err) {
        console.log('Error drawing cards pdf: ', err, JSON.stringify(err));
        return reject(err);
      } finally {
        clearTimeout(timer);
      }
    };

    wrappedDraw().catch((err) => {
      throw new Error(err);
    });
  });
}

export async function uploadPDF(
  pdfBytes: Uint8Array,
  fileURL: string,
  token: string,
  patientId?: string
): Promise<void> {
  if (!patientId) {
    throw new Error('patient ID is undefined!');
  }

  console.log('getting presigned url for z3 upload');
  const presignedURLRequest = await fetch(fileURL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'upload' }),
  });
  console.log('got presigned url for z3 upload');

  console.log('getting presigned url json');
  const presignedURLResponse = await presignedURLRequest.json();
  if (!presignedURLRequest.ok) {
    console.log(presignedURLResponse);
    throw new Error(`Failed to get presigned url: ${presignedURLRequest.statusText}`);
  }
  console.log('got z3 url json', JSON.stringify(presignedURLResponse));

  console.log('uploading to z3 using presigned url');
  const uploadRequest = await fetch(presignedURLResponse.signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: pdfBytes,
  });

  if (!uploadRequest.ok) {
    throw new Error(`Upload request was not OK: ${uploadRequest.statusText}`);
  }
  console.log('upload to z3 using presigned url succeeded');
}
