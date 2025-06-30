import fontkit from '@pdf-lib/fontkit';
import { DocumentReference } from 'fhir/r4b';
import fs from 'fs';
import { Color, PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { STANDARD_FONT_SIZE, STANDARD_FONT_SPACING, Y_POS_GAP } from './pdf-consts';
import { ImageStyle, LineStyle, PageStyles, PdfClient, PdfClientStyles, TextStyle } from './types';

export type PdfInfo = { uploadURL: string; title: string };

export type LabsPDFTextStyleConfig = Record<string, TextStyle>;

// For testing needs
export function savePdfLocally(pdfBytes: Uint8Array): void {
  // Write the Uint8Array to a file
  fs.writeFile('myTestFile.pdf', Buffer.from(pdfBytes), (err: any) => {
    if (err) {
      console.error('Error saving PDF:', err);
    } else {
      console.log('PDF saved successfully!');
    }
  });
}

type PdfDocumentPublishedStatusesKeys = 'published' | 'unpublished';
export const PdfDocumentReferencePublishedStatuses: {
  [key in PdfDocumentPublishedStatusesKeys]: 'final' | 'preliminary';
} = {
  published: 'final',
  unpublished: 'preliminary',
};

export function isDocumentPublished(doc: DocumentReference): boolean {
  return doc.docStatus === PdfDocumentReferencePublishedStatuses.published;
}

export function handleBadSpaces(text: string): string {
  // https://github.com/nodejs/node/issues/46123
  // replacing U+202f with simple whitespace due to bug in NodeJS v18.11 - 18.5
  // for PDFs to work correctly
  return text.replace(' ', ' ');
}

export function splitLongStringToPageSize(
  text: string,
  font: PDFFont,
  fontSize: number,
  desiredWidth: number
): string[] {
  const inputStrings = text.split('\n'); // handle new lines first
  const resultStrings: string[] = [];

  inputStrings.forEach((str) => {
    const words = str.split(' ');

    let validLine = '';
    let lineWidth = 0;
    words.forEach((word) => {
      const wordWidth = font.widthOfTextAtSize(word + ' ', fontSize);
      if (lineWidth + wordWidth <= desiredWidth) {
        validLine = `${validLine.concat(word)} `;
        lineWidth += wordWidth;
      } else {
        resultStrings.push(validLine);
        validLine = word;
        lineWidth = wordWidth;
      }
    });
    resultStrings.push(validLine);
  });
  return resultStrings;
}

export const rgbNormalized = (r: number, g: number, b: number): Color => rgb(r / 255, g / 255, b / 255);

export async function createPdfClient(initialStyles: PdfClientStyles): Promise<PdfClient> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let page: PDFPage;
  let pageLeftBound = 0;
  let pageRightBound = 0;
  let currXPos = 0;
  let currYPos = 0;
  const pageTextWidth = (): number => {
    return pageRightBound - pageLeftBound;
  };
  let pageStyles = initialStyles.initialPage;

  const addNewPage = (styles: PageStyles, newLeftBound?: number, newRightBound?: number): void => {
    page = pdfDoc.addPage();
    page.setSize(styles.width, styles.height);
    const { height, width } = page.getSize();
    // Start at the top of the page then move down as elements are added to the PDF.
    currYPos = height - (styles.pageMargins.top ?? 0); // top of page. Content starts after this point
    currYPos -= Y_POS_GAP; //by default, we have some kind of gap without this subtraction
    pageLeftBound = newLeftBound ? newLeftBound : styles.pageMargins.left ?? 0;
    pageRightBound = newRightBound ? newRightBound : width - (styles.pageMargins.right ?? 0);
    currXPos = pageLeftBound;
    pageStyles = styles;
    if (styles.setHeadline) styles.setHeadline();
  };

  // adding initial page when initializing pdfClient
  addNewPage(initialStyles.initialPage);

  const drawText = (text: string, textStyle: TextStyle): void => {
    const { font, fontSize, color, side, spacing } = textStyle;
    currXPos = pageLeftBound;

    splitLongStringToPageSize(text, font, fontSize, pageTextWidth()).forEach((line, index) => {
      const { width: lineWidth, height: lineHeight } = getTextDimensions(line, textStyle);
      if (currYPos - lineHeight < (pageStyles.pageMargins.bottom ?? 0))
        addNewPage(pageStyles, pageLeftBound, pageRightBound);

      if (index !== 0) currYPos -= lineHeight + spacing; // skip first and add new line before writing text

      if (side === 'right') currXPos = pageLeftBound + pageTextWidth() - lineWidth;
      else if (side === 'center') currXPos = pageLeftBound + (pageTextWidth() - lineWidth) / 2;

      page.drawText(line, {
        font: font,
        size: fontSize,
        x: currXPos,
        y: currYPos,
        color,
      });
    });
    if (textStyle.newLineAfter) {
      const currentTextHeight = font.heightAtSize(fontSize);
      currYPos -= currentTextHeight + spacing;
      currXPos = pageLeftBound;
    }
  };

  /**
   * Draws text starting at the specified xPos. Will default to pageLeftBound if xPos is before
   * left bound. Adds a newline if the starting xPos is at or after the rightPageBound.
   *
   * Warning: does not handle newlines in long strings
   *
   */
  const drawStartXPosSpecifiedText = (
    text: string,
    textStyle: TextStyle,
    startingXPos: number
  ): { endXPos: number; endYPos: number } => {
    const { font, fontSize, spacing } = textStyle;

    const currentTextHeight = font.heightAtSize(fontSize);
    if (startingXPos < pageLeftBound) currXPos = pageLeftBound;
    else if (startingXPos >= pageRightBound) {
      newLine(currentTextHeight);
      currXPos = pageLeftBound;
    } else currXPos = startingXPos;

    drawTextSequential(text, textStyle);

    if (textStyle.newLineAfter) {
      currYPos -= currentTextHeight + spacing;
      currXPos = pageLeftBound;
    }

    return { endXPos: currXPos, endYPos: currYPos };
  };

  const drawTextSequential = (
    text: string,
    textStyle: Exclude<TextStyle, 'side'>,
    leftIndentationXPos?: number
  ): void => {
    const { font, fontSize, color, spacing } = textStyle;
    const { width: lineWidth, height: lineHeight } = getTextDimensions(text, textStyle);
    const validatedLeftIndentationXPos =
      leftIndentationXPos !== undefined && leftIndentationXPos < pageRightBound && leftIndentationXPos > pageLeftBound
        ? leftIndentationXPos
        : pageLeftBound;

    if (leftIndentationXPos) currXPos = leftIndentationXPos;

    // Add a new page if there's no space on the current page
    if (currYPos - lineHeight < (pageStyles.pageMargins.bottom ?? 0)) {
      addNewPage(pageStyles, pageLeftBound, pageRightBound);
      if (leftIndentationXPos) currXPos = validatedLeftIndentationXPos;
    }

    // Calculate available space on the current line
    const availableWidth = pageRightBound - currXPos;

    // If the text fits within the current line, draw it directly
    if (lineWidth < pageRightBound - pageLeftBound) {
      if (lineWidth > availableWidth) newLine(lineHeight + spacing);
      page.drawText(text, {
        font: font,
        size: fontSize,
        x: currXPos,
        y: currYPos,
        color,
      });
      currXPos += lineWidth;

      // If textStyle specifies to move to the next line after drawing
      if (textStyle.newLineAfter) {
        currYPos -= lineHeight + spacing;
        currXPos = pageLeftBound;
        if (leftIndentationXPos) currXPos = validatedLeftIndentationXPos;
      }
    } else {
      // If the text is too wide, find the part that fits
      let fittingText = '';
      let remainingText = text;
      let currentWidth = 0;

      // we need to determine what fits based on word breaks to avoid cutting words off with linebreaks
      const words = remainingText.split(' ');
      const widthOfSpaceChar = getTextDimensions(' ', textStyle).width;

      for (let i = 0; i < words.length; i++) {
        const { width: charWidth } = getTextDimensions(words[i], textStyle);
        if (currentWidth + charWidth + widthOfSpaceChar > availableWidth) {
          fittingText = words.slice(0, i).join(' ');
          remainingText = words.slice(i, undefined).join(' ');
          break;
        }
        currentWidth += charWidth + widthOfSpaceChar;
      }

      // Draw the fitting part on the current line
      page.drawText(fittingText, {
        font: font,
        size: fontSize,
        x: currXPos,
        y: currYPos,
        color,
      });

      // Move to the next line and reset x position
      newLine(lineHeight + spacing);

      // Recursively call the function with the remaining text
      drawTextSequential(remainingText, textStyle, validatedLeftIndentationXPos);
    }
  };

  const drawImage = (img: PDFImage, styles: ImageStyle, textStyle?: TextStyle): void => {
    const { width } = page.getSize();
    const { height } = textStyle ? getTextDimensions('A', textStyle) : { height: styles.height };
    if (currYPos - height < (pageStyles.pageMargins.bottom ?? 0)) addNewPage(pageStyles, pageLeftBound, pageRightBound);

    currYPos -= styles.margin?.top ?? 0;
    currXPos = styles.center ? (width - styles.width) / 2 : currXPos + (styles.margin?.left ?? 0);

    page.drawImage(img, {
      x: currXPos,
      y: currYPos,
      width: styles.width,
      height: styles.height,
    });
    // space after image
    if (styles.center) {
      currYPos -= styles.height + (styles.margin?.bottom ?? 0);
    } else {
      currXPos += styles.width + (styles.margin?.right ?? 0);
    }
  };

  const newLine = (yDrop: number): void => {
    // add check if it's gonna fit in current page or we gonna need new one
    currYPos -= yDrop;
    currXPos = pageLeftBound;
  };

  const getX = (): number => {
    return currXPos;
  };

  const getY = (): number => {
    return currYPos;
  };

  const setX = (x: number): void => {
    currXPos = x;
  };

  const setY = (y: number): void => {
    currYPos = y;
  };

  const getLeftBound = (): number => {
    return pageLeftBound;
  };

  const getRightBound = (): number => {
    return pageRightBound;
  };

  const setLeftBound = (newBound: number): void => {
    pageLeftBound = newBound;
  };

  const setRightBound = (newBound: number): void => {
    pageRightBound = newBound;
  };

  const getTextDimensions = (text: string, textStyle: TextStyle): { width: number; height: number } => {
    const { font, fontSize } = textStyle;
    return {
      width: font.widthOfTextAtSize(text, fontSize),
      height: font.heightAtSize(fontSize),
    };
  };

  const save = async (): Promise<Uint8Array> => {
    return await pdfDoc.save();
  };

  const embedFont = async (file: Buffer): Promise<PDFFont> => {
    return await pdfDoc.embedFont(file);
  };

  const embedStandardFont = async (font: StandardFonts): Promise<PDFFont> => {
    return await pdfDoc.embedFont(font);
  };

  const embedImage = async (file: Buffer): Promise<PDFImage> => {
    return await pdfDoc.embedPng(file);
  };

  const drawSeparatedLine = (lineStyle: LineStyle): void => {
    const startX = pageLeftBound + (lineStyle.margin?.left ?? 0);
    const endX = pageRightBound - (lineStyle.margin?.right ?? 0);
    // we should add 16 to move line in between strings and then subtract margins
    const coordY = currYPos + 16 - (lineStyle.margin?.top ?? 0);
    page.drawLine({
      color: lineStyle.color,
      thickness: lineStyle.thickness,
      start: { x: startX, y: coordY },
      end: { x: endX, y: coordY },
    });
    currYPos -= (lineStyle.margin?.top ?? 0) + lineStyle.thickness + (lineStyle.margin?.bottom ?? 0);
  };

  const setPageStyles = (newStyles: PageStyles): void => {
    pageStyles = newStyles;
  };

  return {
    addNewPage,
    drawText,
    drawTextSequential,
    drawStartXPosSpecifiedText,
    drawImage,
    newLine,
    getX,
    getY,
    setX,
    setY,
    save,
    embedFont,
    embedStandardFont,
    embedImage,
    drawSeparatedLine,
    getLeftBound,
    getRightBound,
    setLeftBound,
    setRightBound,
    getTextDimensions,
    setPageStyles,
  };
}

export const LAB_PDF_STYLES = {
  color: {
    red: rgbNormalized(255, 0, 0),
    purple: rgbNormalized(77, 21, 183),
    black: rgbNormalized(0, 0, 0),
  },
};

export const SEPARATED_LINE_STYLE: LineStyle = {
  thickness: 1,
  color: rgbNormalized(227, 230, 239),
  margin: {
    top: 8,
    bottom: 8,
  },
};

export async function getTextStylesForLabsPDF(pdfClient: PdfClient): Promise<LabsPDFTextStyleConfig> {
  const RubikFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const RubikFontBold = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Bold.otf'));

  const textStyles: Record<string, TextStyle> = {
    blockHeader: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: STANDARD_FONT_SPACING,
      font: RubikFontBold,
      newLineAfter: true,
    },
    header: {
      fontSize: 17,
      spacing: STANDARD_FONT_SPACING,
      font: RubikFontBold,
      color: LAB_PDF_STYLES.color.purple,
      newLineAfter: true,
    },
    headerRight: {
      fontSize: 17,
      spacing: STANDARD_FONT_SPACING,
      font: RubikFontBold,
      side: 'right',
      color: LAB_PDF_STYLES.color.purple,
    },
    fieldHeader: {
      fontSize: STANDARD_FONT_SIZE,
      font: RubikFont,
      spacing: 1,
    },
    fieldHeaderRight: {
      fontSize: STANDARD_FONT_SIZE,
      font: RubikFont,
      spacing: 1,
      side: 'right',
    },
    text: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: RubikFont,
    },
    textBold: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: RubikFontBold,
    },
    textBoldRight: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: RubikFontBold,
      side: 'right',
    },
    textRight: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: RubikFont,
      side: 'right',
    },
    fieldText: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: RubikFont,
      side: 'right',
      newLineAfter: true,
    },
  };
  return textStyles;
}

export const calculateAge = (dob: string): number => {
  const dobDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - dobDate.getFullYear();
  const monthDiff = today.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
    return age - 1;
  }
  return age;
};

export const drawFieldLine = (
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  fieldName: string,
  fieldValue: string
): PdfClient => {
  pdfClient.drawTextSequential(fieldName, textStyles.text);
  pdfClient.drawTextSequential(' ', textStyles.textBold);
  pdfClient.drawTextSequential(fieldValue, textStyles.textBold);
  return pdfClient;
};

export const drawFieldLineRight = (
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  fieldName: string,
  fieldValue: string
): PdfClient => {
  pdfClient.drawStartXPosSpecifiedText(fieldName, textStyles.text, 285);
  pdfClient.drawTextSequential(' ', textStyles.textBold);
  pdfClient.drawTextSequential(fieldValue, textStyles.textBold);
  return pdfClient;
};

export const drawFourColumnText = (
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  columnOne: { name: string; startXPos: number },
  columnTwo: { name: string; startXPos: number },
  columnThree: { name: string; startXPos: number },
  columnFour: { name: string; startXPos: number },
  color?: Color
): PdfClient => {
  const font = textStyles.text;
  const fontSize = STANDARD_FONT_SIZE;
  const fontStyleTemp = { ...font, fontSize: fontSize, color: color };
  pdfClient.drawStartXPosSpecifiedText(columnOne.name, fontStyleTemp, columnOne.startXPos);
  pdfClient.drawStartXPosSpecifiedText(columnTwo.name, fontStyleTemp, columnTwo.startXPos);
  pdfClient.drawStartXPosSpecifiedText(columnThree.name, fontStyleTemp, columnThree.startXPos);
  pdfClient.drawStartXPosSpecifiedText(columnFour.name, fontStyleTemp, columnFour.startXPos);
  return pdfClient;
};
