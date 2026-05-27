import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { BRANDING_CONFIG, PatientEducationSection } from 'utils';
import { rgbNormalized, splitLongStringToPageSize } from './pdf-utils';

export type { PatientEducationSection };

// Parse a #RRGGBB string into the (r, g, b) channel ints rgbNormalized expects.
function parseHexChannels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

// Brand color: wired to the project-wide branding config so the PDF header and the
// email header stay in sync.
const BRAND_BLUE = rgbNormalized(...parseHexChannels(BRANDING_CONFIG.email.palette.headerText));

// PDF-only swatches. Hand-picked for this generator (no canonical entry in BRANDING_CONFIG).
// Same notation as the other PDF generators in this directory (see progress-note-pdf.ts).
const BRAND_LIGHT_BLUE = rgbNormalized(224, 237, 250);
const ACCENT_ORANGE = rgbNormalized(230, 115, 25);
const TEXT_DARK = rgbNormalized(38, 38, 38);
const TEXT_LIGHT = rgbNormalized(115, 115, 115);
const DIVIDER_COLOR = rgbNormalized(209, 209, 209);
const WARNING_BG = rgbNormalized(255, 247, 237);
const WARNING_BORDER = rgbNormalized(230, 153, 51);

// Page layout (US Letter at 72 DPI: 612 × 792 pt). Kept at module scope so the values
// that don't depend on input live in one named block instead of as magic numbers in code.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const MAX_CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Typography
const BODY_FONT_SIZE = 10.5;
const SECTION_HEADER_FONT_SIZE = 13;
const TITLE_FONT_SIZE = 24;
const FOOTER_FONT_SIZE = 8;
const LINE_HEIGHT_RATIO = 1.55; // multiplier applied to body font size for normal text
const SECTION_HEADER_LINE_HEIGHT_RATIO = 2;
const TITLE_LINE_HEIGHT_RATIO = 1.3;
// Derived line heights — computed once at module scope rather than every render.
const LINE_HEIGHT = BODY_FONT_SIZE * LINE_HEIGHT_RATIO;
const SECTION_HEADER_LINE_HEIGHT = SECTION_HEADER_FONT_SIZE * SECTION_HEADER_LINE_HEIGHT_RATIO;

// Title banner
const TITLE_BANNER_HEIGHT = 60;
const TITLE_HORIZONTAL_PADDING = 20;
const TITLE_BASELINE_NUDGE_RATIO = 0.3; // shifts the title's baseline so it visually centers
const ACCENT_RULE_THICKNESS = 2;
const ACCENT_RULE_GAP = 8;
const ACCENT_RULE_TO_BODY_GAP = 15;

// Footer
const FOOTER_RULE_OFFSET = 5; // vertical distance from text baseline to divider
const FOOTER_PRIMARY_LINE_OFFSET = 18; // first line of footer text below page margin
const FOOTER_SECONDARY_LINE_OFFSET = 28; // second line of footer text
const FOOTER_PAGE_NUMBER_RIGHT_INSET = 50;
const FOOTER_DIVIDER_THICKNESS = 0.5;

// Warning callout
const WARNING_HORIZONTAL_PADDING = 14; // text inset within the callout box on each side
const WARNING_VERTICAL_PADDING = 8; // top/bottom inset within the callout box
const WARNING_BULLET_INDENT = 16;

// Paragraph-classification regexes — hoisted so they're compiled once, not per paragraph.
const H2_RE = /^##\s/;
const H3_RE = /^###\s/;
const ALL_CAPS_HEADER_RE = /^[A-Z][A-Z\s/()-]{3,}:?$/;
const NUMBERED_HEADER_RE = /^\d+\.\s+[A-Z]/;
const BULLET_RE = /^[-•]\s/;
const WARNING_RE = /seek.*(?:emergency|immediate|urgent)|call\s+911|go\s+to\s+(?:the\s+)?(?:emergency|ER)/i;
const MARKDOWN_HEADING_PREFIX_RE = /^#{1,3}\s*/;
const MARKDOWN_BOLD_RE = /\*\*/g;

export async function createPatientEducationPdf(sections: PatientEducationSection[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  function addNewPage(): { page: ReturnType<typeof pdfDoc.addPage>; y: number } {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page, y: PAGE_HEIGHT - MARGIN };
  }

  function drawFooter(
    page: ReturnType<typeof pdfDoc.addPage>,
    pageNum: number,
    totalPages: number,
    icdLabel: string
  ): void {
    page.drawLine({
      start: { x: MARGIN, y: MARGIN - FOOTER_RULE_OFFSET },
      end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - FOOTER_RULE_OFFSET },
      thickness: FOOTER_DIVIDER_THICKNESS,
      color: DIVIDER_COLOR,
    });
    page.drawText(icdLabel, {
      x: MARGIN,
      y: MARGIN - FOOTER_PRIMARY_LINE_OFFSET,
      size: FOOTER_FONT_SIZE,
      font: helveticaOblique,
      color: TEXT_LIGHT,
    });
    const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    page.drawText(`Generated: ${formattedDate}  |  Source: MedlinePlus`, {
      x: MARGIN,
      y: MARGIN - FOOTER_SECONDARY_LINE_OFFSET,
      size: FOOTER_FONT_SIZE,
      font: helvetica,
      color: TEXT_LIGHT,
    });
    page.drawText(`Page ${pageNum} of ${totalPages}`, {
      x: PAGE_WIDTH - MARGIN - FOOTER_PAGE_NUMBER_RIGHT_INSET,
      y: MARGIN - FOOTER_PRIMARY_LINE_OFFSET,
      size: FOOTER_FONT_SIZE,
      font: helvetica,
      color: TEXT_LIGHT,
    });
  }

  const allPages: { page: ReturnType<typeof pdfDoc.addPage>; icdLabel: string }[] = [];

  for (const section of sections) {
    let { page, y } = addNewPage();
    const icdLabel = `${section.icdCode} — ${section.icdDescription}`;
    allPages.push({ page, icdLabel });

    const bannerHeight = TITLE_BANNER_HEIGHT;
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - bannerHeight,
      width: PAGE_WIDTH,
      height: bannerHeight,
      color: BRAND_BLUE,
    });
    const titleLines = splitLongStringToPageSize(
      section.patientTitle,
      helveticaBold,
      TITLE_FONT_SIZE,
      MAX_CONTENT_WIDTH - TITLE_HORIZONTAL_PADDING
    );
    const titleBlockHeight = titleLines.length * TITLE_FONT_SIZE * TITLE_LINE_HEIGHT_RATIO;
    const bannerCenterY = PAGE_HEIGHT - bannerHeight / 2;
    let titleY = bannerCenterY + titleBlockHeight / 2 - TITLE_FONT_SIZE * TITLE_BASELINE_NUDGE_RATIO;
    for (const line of titleLines) {
      const titleWidth = helveticaBold.widthOfTextAtSize(line, TITLE_FONT_SIZE);
      const titleX = (PAGE_WIDTH - titleWidth) / 2;
      page.drawText(line, { x: titleX, y: titleY, size: TITLE_FONT_SIZE, font: helveticaBold, color: rgb(1, 1, 1) });
      titleY -= TITLE_FONT_SIZE * TITLE_LINE_HEIGHT_RATIO;
    }
    y = PAGE_HEIGHT - bannerHeight - ACCENT_RULE_GAP;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: ACCENT_RULE_THICKNESS,
      color: ACCENT_ORANGE,
    });
    y -= ACCENT_RULE_TO_BODY_GAP;

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

      const isH2 = H2_RE.test(trimmed);
      const isH3 = H3_RE.test(trimmed);
      const isAllCapsHeader = ALL_CAPS_HEADER_RE.test(trimmed) && !trimmed.includes('.');
      const isNumberedHeader = NUMBERED_HEADER_RE.test(trimmed);
      const isHeader = isH2 || isH3 || isAllCapsHeader || isNumberedHeader;
      const isBullet = BULLET_RE.test(trimmed);
      const isWarning = WARNING_RE.test(trimmed);
      const cleanText = trimmed.replace(MARKDOWN_HEADING_PREFIX_RE, '').replace(MARKDOWN_BOLD_RE, '');

      if (isHeader) {
        blocks.push({ type: 'header', cleanText, isWarningLine: false, rawTrimmed: trimmed });
      } else if (isBullet) {
        blocks.push({ type: 'bullet', cleanText, isWarningLine: isWarning, rawTrimmed: trimmed });
      } else {
        blocks.push({ type: 'text', cleanText, isWarningLine: isWarning, rawTrimmed: trimmed });
      }
    }

    const calcWarningGroupHeight = (startIdx: number): { endIdx: number; totalHeight: number } => {
      const warningTextWidth = MAX_CONTENT_WIDTH - WARNING_HORIZONTAL_PADDING * 2;
      let height = WARNING_VERTICAL_PADDING;
      let idx = startIdx;

      const firstLines = splitLongStringToPageSize(blocks[idx].cleanText, helvetica, BODY_FONT_SIZE, warningTextWidth);
      height += firstLines.length * LINE_HEIGHT;
      idx++;

      while (idx < blocks.length) {
        const block = blocks[idx];
        if (block.type === 'header' || block.type === 'empty') break;
        if (block.type === 'text' && !block.isWarningLine) break;
        if (block.type === 'bullet') {
          const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
          const bulletLines = splitLongStringToPageSize(
            bulletText,
            helvetica,
            BODY_FONT_SIZE,
            warningTextWidth - WARNING_BULLET_INDENT
          );
          height += bulletLines.length * LINE_HEIGHT;
        } else {
          const textLines = splitLongStringToPageSize(block.cleanText, helvetica, BODY_FONT_SIZE, warningTextWidth);
          height += textLines.length * LINE_HEIGHT;
        }
        idx++;
      }

      height += WARNING_VERTICAL_PADDING;
      return { endIdx: idx, totalHeight: height };
    };

    let blockIdx = 0;
    while (blockIdx < blocks.length) {
      const block = blocks[blockIdx];

      if (block.type === 'empty') {
        y -= LINE_HEIGHT * 0.4;
        blockIdx++;
        continue;
      }

      const neededSpace = block.type === 'header' ? SECTION_HEADER_LINE_HEIGHT + 30 : LINE_HEIGHT + 5;
      if (y < MARGIN + 40 + neededSpace) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        allPages.push({ page, icdLabel });
        y = PAGE_HEIGHT - MARGIN;
      }

      if (block.type === 'header') {
        y -= 8;
        const headerBoxHeight = SECTION_HEADER_FONT_SIZE * 1.6;
        page.drawRectangle({
          x: MARGIN,
          y: y - headerBoxHeight + SECTION_HEADER_FONT_SIZE + 2,
          width: MAX_CONTENT_WIDTH,
          height: headerBoxHeight,
          color: BRAND_LIGHT_BLUE,
        });
        page.drawRectangle({
          x: MARGIN,
          y: y - headerBoxHeight + SECTION_HEADER_FONT_SIZE + 2,
          width: 3,
          height: headerBoxHeight,
          color: BRAND_BLUE,
        });
        page.drawText(block.cleanText, {
          x: MARGIN + 10,
          y: y,
          size: SECTION_HEADER_FONT_SIZE,
          font: helveticaBold,
          color: BRAND_BLUE,
        });
        y -= SECTION_HEADER_LINE_HEIGHT;
        blockIdx++;
      } else if (block.type === 'bullet' && !block.isWarningLine) {
        const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
        const bulletLines = splitLongStringToPageSize(
          bulletText,
          helvetica,
          BODY_FONT_SIZE,
          MAX_CONTENT_WIDTH - TITLE_HORIZONTAL_PADDING
        );
        for (let i = 0; i < bulletLines.length; i++) {
          if (y < MARGIN + 40) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            allPages.push({ page, icdLabel });
            y = PAGE_HEIGHT - MARGIN;
          }
          if (i === 0) {
            page.drawCircle({
              x: MARGIN + 6,
              y: y + BODY_FONT_SIZE * 0.3,
              size: 2,
              color: ACCENT_ORANGE,
            });
          }
          page.drawText(bulletLines[i], {
            x: MARGIN + 16,
            y,
            size: BODY_FONT_SIZE,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= LINE_HEIGHT;
        }
        blockIdx++;
      } else if (block.isWarningLine && (block.type === 'text' || block.type === 'bullet')) {
        const { endIdx, totalHeight } = calcWarningGroupHeight(blockIdx);

        if (y < MARGIN + 40 + totalHeight) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          allPages.push({ page, icdLabel });
          y = PAGE_HEIGHT - MARGIN;
        }

        y -= 4;
        const boxTop = y + BODY_FONT_SIZE + 4;
        page.drawRectangle({
          x: MARGIN,
          y: boxTop - totalHeight,
          width: MAX_CONTENT_WIDTH,
          height: totalHeight,
          color: WARNING_BG,
          borderColor: WARNING_BORDER,
          borderWidth: 1,
        });
        page.drawText('!', { x: MARGIN + 9, y: y - 1, size: 14, font: helveticaBold, color: WARNING_BORDER });

        const warningTextX = MARGIN + 22;
        const warningTextWidth = MAX_CONTENT_WIDTH - WARNING_HORIZONTAL_PADDING * 2;

        for (let wi = blockIdx; wi < endIdx; wi++) {
          const wBlock = blocks[wi];
          if (wBlock.type === 'bullet') {
            const bulletText = wBlock.cleanText.replace(/^[-•]\s*/, '');
            const bulletLines = splitLongStringToPageSize(
              bulletText,
              helvetica,
              BODY_FONT_SIZE,
              warningTextWidth - WARNING_BULLET_INDENT
            );
            for (let i = 0; i < bulletLines.length; i++) {
              if (i === 0) {
                page.drawCircle({
                  x: warningTextX + 4,
                  y: y + BODY_FONT_SIZE * 0.3,
                  size: 2,
                  color: WARNING_BORDER,
                });
              }
              page.drawText(bulletLines[i], {
                x: warningTextX + 14,
                y,
                size: BODY_FONT_SIZE,
                font: helvetica,
                color: TEXT_DARK,
              });
              y -= LINE_HEIGHT;
            }
          } else {
            const lines = splitLongStringToPageSize(wBlock.cleanText, helvetica, BODY_FONT_SIZE, warningTextWidth);
            for (const line of lines) {
              page.drawText(line, {
                x: warningTextX,
                y,
                size: BODY_FONT_SIZE,
                font: helvetica,
                color: TEXT_DARK,
              });
              y -= LINE_HEIGHT;
            }
          }
        }

        y -= 4;
        blockIdx = endIdx;
      } else {
        const lines = splitLongStringToPageSize(block.cleanText, helvetica, BODY_FONT_SIZE, MAX_CONTENT_WIDTH);
        for (const line of lines) {
          if (y < MARGIN + 40) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            allPages.push({ page, icdLabel });
            y = PAGE_HEIGHT - MARGIN;
          }
          page.drawText(line, {
            x: MARGIN,
            y,
            size: BODY_FONT_SIZE,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= LINE_HEIGHT;
        }
        blockIdx++;
      }
    }
  }

  const totalPages = allPages.length;
  allPages.forEach(({ page, icdLabel }, idx) => drawFooter(page, idx + 1, totalPages, icdLabel));

  return pdfDoc.save();
}
