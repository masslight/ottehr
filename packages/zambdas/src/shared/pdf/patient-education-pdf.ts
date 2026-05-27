import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PatientEducationSection } from 'utils';

export type { PatientEducationSection };

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const approxWidth = testLine.length * fontSize * 0.48;
    if (approxWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

const BRAND_BLUE = rgb(0.06, 0.2, 0.49);
const BRAND_LIGHT_BLUE = rgb(0.88, 0.93, 0.98);
const ACCENT_ORANGE = rgb(0.9, 0.45, 0.1);
const TEXT_DARK = rgb(0.15, 0.15, 0.15);
const TEXT_LIGHT = rgb(0.45, 0.45, 0.45);
const DIVIDER_COLOR = rgb(0.82, 0.82, 0.82);
const WARNING_BG = rgb(1, 0.97, 0.93);
const WARNING_BORDER = rgb(0.9, 0.6, 0.2);

export async function createPatientEducationPdf(sections: PatientEducationSection[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  const bodyFontSize = 10.5;
  const sectionHeaderFontSize = 13;
  const titleFontSize = 24;
  const lineHeight = bodyFontSize * 1.55;
  const sectionHeaderLineHeight = sectionHeaderFontSize * 2;

  function addNewPage(): { page: ReturnType<typeof pdfDoc.addPage>; y: number } {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    return { page, y: pageHeight - margin };
  }

  function drawFooter(
    page: ReturnType<typeof pdfDoc.addPage>,
    pageNum: number,
    totalPages: number,
    icdLabel: string
  ): void {
    page.drawLine({
      start: { x: margin, y: margin - 5 },
      end: { x: pageWidth - margin, y: margin - 5 },
      thickness: 0.5,
      color: DIVIDER_COLOR,
    });
    page.drawText(icdLabel, {
      x: margin,
      y: margin - 18,
      size: 8,
      font: helveticaOblique,
      color: TEXT_LIGHT,
    });
    const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    page.drawText(`Generated: ${formattedDate}  |  Source: MedlinePlus`, {
      x: margin,
      y: margin - 28,
      size: 8,
      font: helvetica,
      color: TEXT_LIGHT,
    });
    page.drawText(`Page ${pageNum} of ${totalPages}`, {
      x: pageWidth - margin - 50,
      y: margin - 18,
      size: 8,
      font: helvetica,
      color: TEXT_LIGHT,
    });
  }

  const allPages: { page: ReturnType<typeof pdfDoc.addPage>; icdLabel: string }[] = [];

  for (const section of sections) {
    let { page, y } = addNewPage();
    const icdLabel = `${section.icdCode} — ${section.icdDescription}`;
    allPages.push({ page, icdLabel });

    const bannerHeight = 60;
    page.drawRectangle({
      x: 0,
      y: pageHeight - bannerHeight,
      width: pageWidth,
      height: bannerHeight,
      color: BRAND_BLUE,
    });
    const titleLines = wrapText(section.patientTitle, titleFontSize, maxWidth - 20);
    const titleBlockHeight = titleLines.length * titleFontSize * 1.3;
    const bannerCenterY = pageHeight - bannerHeight / 2;
    let titleY = bannerCenterY + titleBlockHeight / 2 - titleFontSize * 0.3;
    for (const line of titleLines) {
      const titleWidth = helveticaBold.widthOfTextAtSize(line, titleFontSize);
      const titleX = (pageWidth - titleWidth) / 2;
      page.drawText(line, { x: titleX, y: titleY, size: titleFontSize, font: helveticaBold, color: rgb(1, 1, 1) });
      titleY -= titleFontSize * 1.3;
    }
    y = pageHeight - bannerHeight - 8;

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 2,
      color: ACCENT_ORANGE,
    });
    y -= 15;

    interface ParagraphBlock {
      type: 'empty' | 'header' | 'bullet' | 'text';
      cleanText: string;
      isWarningLine: boolean;
      rawTrimmed: string;
    }

    const paragraphs = section.content.split('\n');
    const blocks: ParagraphBlock[] = [];

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        blocks.push({ type: 'empty', cleanText: '', isWarningLine: false, rawTrimmed: '' });
        continue;
      }

      const isH2 = /^##\s/.test(trimmed);
      const isH3 = /^###\s/.test(trimmed);
      const isAllCapsHeader = /^[A-Z][A-Z\s/()-]{3,}:?$/.test(trimmed) && !trimmed.includes('.');
      const isNumberedHeader = /^\d+\.\s+[A-Z]/.test(trimmed);
      const isHeader = isH2 || isH3 || isAllCapsHeader || isNumberedHeader;
      const isBullet = /^[-•]\s/.test(trimmed);
      const isWarning = /seek.*(?:emergency|immediate|urgent)|call\s+911|go\s+to\s+(?:the\s+)?(?:emergency|ER)/i.test(
        trimmed
      );
      const cleanText = trimmed.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '');

      if (isHeader) {
        blocks.push({ type: 'header', cleanText, isWarningLine: false, rawTrimmed: trimmed });
      } else if (isBullet) {
        blocks.push({ type: 'bullet', cleanText, isWarningLine: isWarning, rawTrimmed: trimmed });
      } else {
        blocks.push({ type: 'text', cleanText, isWarningLine: isWarning, rawTrimmed: trimmed });
      }
    }

    const calcWarningGroupHeight = (startIdx: number): { endIdx: number; totalHeight: number } => {
      const warningTextWidth = maxWidth - 28;
      let height = 8;
      let idx = startIdx;

      const firstLines = wrapText(blocks[idx].cleanText, bodyFontSize, warningTextWidth);
      height += firstLines.length * lineHeight;
      idx++;

      while (idx < blocks.length) {
        const block = blocks[idx];
        if (block.type === 'header' || block.type === 'empty') break;
        if (block.type === 'text' && !block.isWarningLine) break;
        if (block.type === 'bullet') {
          const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
          const bulletLines = wrapText(bulletText, bodyFontSize, warningTextWidth - 16);
          height += bulletLines.length * lineHeight;
        } else {
          const textLines = wrapText(block.cleanText, bodyFontSize, warningTextWidth);
          height += textLines.length * lineHeight;
        }
        idx++;
      }

      height += 8;
      return { endIdx: idx, totalHeight: height };
    };

    let blockIdx = 0;
    while (blockIdx < blocks.length) {
      const block = blocks[blockIdx];

      if (block.type === 'empty') {
        y -= lineHeight * 0.4;
        blockIdx++;
        continue;
      }

      const neededSpace = block.type === 'header' ? sectionHeaderLineHeight + 30 : lineHeight + 5;
      if (y < margin + 40 + neededSpace) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        allPages.push({ page, icdLabel });
        y = pageHeight - margin;
      }

      if (block.type === 'header') {
        y -= 8;
        const headerBoxHeight = sectionHeaderFontSize * 1.6;
        page.drawRectangle({
          x: margin,
          y: y - headerBoxHeight + sectionHeaderFontSize + 2,
          width: maxWidth,
          height: headerBoxHeight,
          color: BRAND_LIGHT_BLUE,
        });
        page.drawRectangle({
          x: margin,
          y: y - headerBoxHeight + sectionHeaderFontSize + 2,
          width: 3,
          height: headerBoxHeight,
          color: BRAND_BLUE,
        });
        page.drawText(block.cleanText, {
          x: margin + 10,
          y: y,
          size: sectionHeaderFontSize,
          font: helveticaBold,
          color: BRAND_BLUE,
        });
        y -= sectionHeaderLineHeight;
        blockIdx++;
      } else if (block.type === 'bullet' && !block.isWarningLine) {
        const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
        const bulletLines = wrapText(bulletText, bodyFontSize, maxWidth - 20);
        for (let i = 0; i < bulletLines.length; i++) {
          if (y < margin + 40) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            allPages.push({ page, icdLabel });
            y = pageHeight - margin;
          }
          if (i === 0) {
            page.drawCircle({
              x: margin + 6,
              y: y + bodyFontSize * 0.3,
              size: 2,
              color: ACCENT_ORANGE,
            });
          }
          page.drawText(bulletLines[i], {
            x: margin + 16,
            y,
            size: bodyFontSize,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= lineHeight;
        }
        blockIdx++;
      } else if (block.isWarningLine && (block.type === 'text' || block.type === 'bullet')) {
        const { endIdx, totalHeight } = calcWarningGroupHeight(blockIdx);

        if (y < margin + 40 + totalHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          allPages.push({ page, icdLabel });
          y = pageHeight - margin;
        }

        y -= 4;
        const boxTop = y + bodyFontSize + 4;
        page.drawRectangle({
          x: margin,
          y: boxTop - totalHeight,
          width: maxWidth,
          height: totalHeight,
          color: WARNING_BG,
          borderColor: WARNING_BORDER,
          borderWidth: 1,
        });
        page.drawText('!', { x: margin + 9, y: y - 1, size: 14, font: helveticaBold, color: WARNING_BORDER });

        const warningTextX = margin + 22;
        const warningTextWidth = maxWidth - 28;

        for (let wi = blockIdx; wi < endIdx; wi++) {
          const wBlock = blocks[wi];
          if (wBlock.type === 'bullet') {
            const bulletText = wBlock.cleanText.replace(/^[-•]\s*/, '');
            const bulletLines = wrapText(bulletText, bodyFontSize, warningTextWidth - 16);
            for (let i = 0; i < bulletLines.length; i++) {
              if (i === 0) {
                page.drawCircle({
                  x: warningTextX + 4,
                  y: y + bodyFontSize * 0.3,
                  size: 2,
                  color: WARNING_BORDER,
                });
              }
              page.drawText(bulletLines[i], {
                x: warningTextX + 14,
                y,
                size: bodyFontSize,
                font: helvetica,
                color: TEXT_DARK,
              });
              y -= lineHeight;
            }
          } else {
            const lines = wrapText(wBlock.cleanText, bodyFontSize, warningTextWidth);
            for (const line of lines) {
              page.drawText(line, {
                x: warningTextX,
                y,
                size: bodyFontSize,
                font: helvetica,
                color: TEXT_DARK,
              });
              y -= lineHeight;
            }
          }
        }

        y -= 4;
        blockIdx = endIdx;
      } else {
        const lines = wrapText(block.cleanText, bodyFontSize, maxWidth);
        for (const line of lines) {
          if (y < margin + 40) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            allPages.push({ page, icdLabel });
            y = pageHeight - margin;
          }
          page.drawText(line, {
            x: margin,
            y,
            size: bodyFontSize,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= lineHeight;
        }
        blockIdx++;
      }
    }
  }

  const totalPages = allPages.length;
  allPages.forEach(({ page, icdLabel }, idx) => drawFooter(page, idx + 1, totalPages, icdLabel));

  return pdfDoc.save();
}
