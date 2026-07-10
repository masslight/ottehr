import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { BRANDING_CONFIG, fitWrappedTextToBanner, PatientEducationLanguage, PatientEducationSection } from 'utils';
import { rgbNormalized, splitLongStringToPageSize } from './pdf-utils';

export type { PatientEducationSection };

function parseHexChannels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

const H2_RE = /^##\s/;
const H3_RE = /^###\s/;
const ALL_CAPS_HEADER_RE = /^[A-Z][A-Z\s/()-]{3,}:?$/;
const NUMBERED_HEADER_RE = /^\d+\.\s+[A-Z]/;
const BULLET_RE = /^[-•]\s/;
const WARNING_RE = /seek.*(?:emergency|immediate|urgent)|call\s+911|go\s+to\s+(?:the\s+)?(?:emergency|ER)/i;
const MARKDOWN_HEADING_PREFIX_RE = /^#{1,3}\s*/;
const MARKDOWN_BOLD_RE = /\*\*/g;

export async function createPatientEducationPdf(
  sections: PatientEducationSection[],
  language: PatientEducationLanguage = 'en'
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const styles = {
    page: {
      width: 612,
      height: 792,
      margin: 48,
    },
    colors: {
      brandBlue: rgbNormalized(...parseHexChannels(BRANDING_CONFIG.email.palette.headerText)),
      brandLightBlue: rgbNormalized(224, 237, 250),
      accentOrange: rgbNormalized(230, 115, 25),
      textDark: rgbNormalized(38, 38, 38),
      textLight: rgbNormalized(115, 115, 115),
      divider: rgbNormalized(209, 209, 209),
      warningBg: rgbNormalized(255, 247, 237),
      warningBorder: rgbNormalized(230, 153, 51),
    },
    fontSize: {
      body: 10.5,
      sectionHeader: 13,
      title: 24,
      titleMin: 18,
      footer: 8,
    },
    lineHeightRatio: {
      body: 1.55,
      sectionHeader: 2,
      title: 1.3,
    },
    titleBanner: {
      height: 80,
      horizontalPadding: 20,
      verticalPadding: 10,
      maxLines: 3,
      accentRuleThickness: 2,
      accentRuleGap: 8,
      accentRuleToBodyGap: 15,
    },
    footer: {
      ruleOffset: 5,
      primaryLineOffset: 18,
      secondaryLineOffset: 28,
      pageNumberRightInset: 50,
      dividerThickness: 0.5,
    },
    sectionHeader: {
      preGap: 8,
      boxHeightRatio: 1.6,
      baselineNudge: 2,
      accentBarWidth: 3,
      textInset: 10,
    },
    bullet: {
      dotInset: 6,
      textInset: 16,
      dotRadius: 2,
      dotVerticalRatio: 0.3,
    },
    warning: {
      horizontalPadding: 14,
      verticalPadding: 8,
      bulletIndent: 16,
      boxTopGap: 4,
      boxTopPadding: 4,
      iconInset: 9,
      iconYNudge: 1,
      iconFontSize: 14,
      borderWidth: 1,
      textInset: 22,
      bulletDotOffset: 4,
      bulletTextOffset: 14,
      bulletDotRadius: 2,
    },
    pagination: {
      bottomSafeZone: 40,
      headerLookahead: 30,
      bodyLookahead: 5,
    },
    paragraph: {
      emptyGapRatio: 0.4,
    },
  };

  const maxContentWidth = styles.page.width - styles.page.margin * 2;
  const bodyLineHeight = styles.fontSize.body * styles.lineHeightRatio.body;
  const sectionHeaderLineHeight = styles.fontSize.sectionHeader * styles.lineHeightRatio.sectionHeader;

  function addNewPage(): { page: ReturnType<typeof pdfDoc.addPage>; y: number } {
    const page = pdfDoc.addPage([styles.page.width, styles.page.height]);
    return { page, y: styles.page.height - styles.page.margin };
  }

  function drawFooter(
    page: ReturnType<typeof pdfDoc.addPage>,
    pageNum: number,
    totalPages: number,
    icdLabel: string
  ): void {
    page.drawLine({
      start: { x: styles.page.margin, y: styles.page.margin - styles.footer.ruleOffset },
      end: { x: styles.page.width - styles.page.margin, y: styles.page.margin - styles.footer.ruleOffset },
      thickness: styles.footer.dividerThickness,
      color: styles.colors.divider,
    });
    page.drawText(icdLabel, {
      x: styles.page.margin,
      y: styles.page.margin - styles.footer.primaryLineOffset,
      size: styles.fontSize.footer,
      font: helveticaOblique,
      color: styles.colors.textLight,
    });
    const formattedDate = new Date().toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const sourceText =
      language === 'es'
        ? `Generado: ${formattedDate}  |  Fuente: MedlinePlus`
        : `Generated: ${formattedDate}  |  Source: MedlinePlus`;
    page.drawText(sourceText, {
      x: styles.page.margin,
      y: styles.page.margin - styles.footer.secondaryLineOffset,
      size: styles.fontSize.footer,
      font: helvetica,
      color: styles.colors.textLight,
    });
    const pageNumberText =
      language === 'es' ? `Página ${pageNum} de ${totalPages}` : `Page ${pageNum} of ${totalPages}`;
    page.drawText(pageNumberText, {
      x: styles.page.width - styles.page.margin - helvetica.widthOfTextAtSize(pageNumberText, styles.fontSize.footer),
      y: styles.page.margin - styles.footer.primaryLineOffset,
      size: styles.fontSize.footer,
      font: helvetica,
      color: styles.colors.textLight,
    });
  }

  const allPages: { page: ReturnType<typeof pdfDoc.addPage>; icdLabel: string }[] = [];

  for (const section of sections) {
    let { page, y } = addNewPage();
    const icdLabel = `${section.icdCode} — ${section.icdDescription}`;
    allPages.push({ page, icdLabel });

    const bannerHeight = styles.titleBanner.height;
    page.drawRectangle({
      x: 0,
      y: styles.page.height - bannerHeight,
      width: styles.page.width,
      height: bannerHeight,
      color: styles.colors.brandBlue,
    });
    const fittedTitle = fitWrappedTextToBanner({
      text: section.patientTitle,
      font: helveticaBold,
      maxWidth: maxContentWidth - styles.titleBanner.horizontalPadding,
      initialFontSize: styles.fontSize.title,
      minFontSize: styles.fontSize.titleMin,
      lineHeightRatio: styles.lineHeightRatio.title,
      bannerHeight,
      verticalPadding: styles.titleBanner.verticalPadding,
      maxLines: styles.titleBanner.maxLines,
    });
    const bannerCenterY = styles.page.height - bannerHeight / 2;
    let titleY = bannerCenterY + fittedTitle.blockHeight / 2 - fittedTitle.ascender;
    for (const line of fittedTitle.lines) {
      const titleWidth = helveticaBold.widthOfTextAtSize(line, fittedTitle.fontSize);
      const titleX = (styles.page.width - titleWidth) / 2;
      page.drawText(line, {
        x: titleX,
        y: titleY,
        size: fittedTitle.fontSize,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      titleY -= fittedTitle.lineHeight;
    }
    y = styles.page.height - bannerHeight - styles.titleBanner.accentRuleGap;

    page.drawLine({
      start: { x: styles.page.margin, y },
      end: { x: styles.page.width - styles.page.margin, y },
      thickness: styles.titleBanner.accentRuleThickness,
      color: styles.colors.accentOrange,
    });
    y -= styles.titleBanner.accentRuleToBodyGap;

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
      const warningTextWidth = maxContentWidth - styles.warning.horizontalPadding * 2;
      let height = styles.warning.verticalPadding;
      let idx = startIdx;

      const firstLines = splitLongStringToPageSize(
        blocks[idx].cleanText,
        helvetica,
        styles.fontSize.body,
        warningTextWidth
      );
      height += firstLines.length * bodyLineHeight;
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
            styles.fontSize.body,
            warningTextWidth - styles.warning.bulletIndent
          );
          height += bulletLines.length * bodyLineHeight;
        } else {
          const textLines = splitLongStringToPageSize(
            block.cleanText,
            helvetica,
            styles.fontSize.body,
            warningTextWidth
          );
          height += textLines.length * bodyLineHeight;
        }
        idx++;
      }

      height += styles.warning.verticalPadding;
      return { endIdx: idx, totalHeight: height };
    };

    let blockIdx = 0;
    while (blockIdx < blocks.length) {
      const block = blocks[blockIdx];

      if (block.type === 'empty') {
        y -= bodyLineHeight * styles.paragraph.emptyGapRatio;
        blockIdx++;
        continue;
      }

      const neededSpace =
        block.type === 'header'
          ? sectionHeaderLineHeight + styles.pagination.headerLookahead
          : bodyLineHeight + styles.pagination.bodyLookahead;
      if (y < styles.page.margin + styles.pagination.bottomSafeZone + neededSpace) {
        page = pdfDoc.addPage([styles.page.width, styles.page.height]);
        allPages.push({ page, icdLabel });
        y = styles.page.height - styles.page.margin;
      }

      if (block.type === 'header') {
        y -= styles.sectionHeader.preGap;
        const headerBoxHeight = styles.fontSize.sectionHeader * styles.sectionHeader.boxHeightRatio;
        const headerBoxY = y - headerBoxHeight + styles.fontSize.sectionHeader + styles.sectionHeader.baselineNudge;
        page.drawRectangle({
          x: styles.page.margin,
          y: headerBoxY,
          width: maxContentWidth,
          height: headerBoxHeight,
          color: styles.colors.brandLightBlue,
        });
        page.drawRectangle({
          x: styles.page.margin,
          y: headerBoxY,
          width: styles.sectionHeader.accentBarWidth,
          height: headerBoxHeight,
          color: styles.colors.brandBlue,
        });
        page.drawText(block.cleanText, {
          x: styles.page.margin + styles.sectionHeader.textInset,
          y: y,
          size: styles.fontSize.sectionHeader,
          font: helveticaBold,
          color: styles.colors.brandBlue,
        });
        y -= sectionHeaderLineHeight;
        blockIdx++;
      } else if (block.type === 'bullet' && !block.isWarningLine) {
        const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
        const bulletLines = splitLongStringToPageSize(
          bulletText,
          helvetica,
          styles.fontSize.body,
          maxContentWidth - styles.titleBanner.horizontalPadding
        );
        for (let i = 0; i < bulletLines.length; i++) {
          if (y < styles.page.margin + styles.pagination.bottomSafeZone) {
            page = pdfDoc.addPage([styles.page.width, styles.page.height]);
            allPages.push({ page, icdLabel });
            y = styles.page.height - styles.page.margin;
          }
          if (i === 0) {
            page.drawCircle({
              x: styles.page.margin + styles.bullet.dotInset,
              y: y + styles.fontSize.body * styles.bullet.dotVerticalRatio,
              size: styles.bullet.dotRadius,
              color: styles.colors.accentOrange,
            });
          }
          page.drawText(bulletLines[i], {
            x: styles.page.margin + styles.bullet.textInset,
            y,
            size: styles.fontSize.body,
            font: helvetica,
            color: styles.colors.textDark,
          });
          y -= bodyLineHeight;
        }
        blockIdx++;
      } else if (block.isWarningLine && (block.type === 'text' || block.type === 'bullet')) {
        const { endIdx, totalHeight } = calcWarningGroupHeight(blockIdx);

        if (y < styles.page.margin + styles.pagination.bottomSafeZone + totalHeight) {
          page = pdfDoc.addPage([styles.page.width, styles.page.height]);
          allPages.push({ page, icdLabel });
          y = styles.page.height - styles.page.margin;
        }

        y -= styles.warning.boxTopGap;
        const boxTop = y + styles.fontSize.body + styles.warning.boxTopPadding;
        page.drawRectangle({
          x: styles.page.margin,
          y: boxTop - totalHeight,
          width: maxContentWidth,
          height: totalHeight,
          color: styles.colors.warningBg,
          borderColor: styles.colors.warningBorder,
          borderWidth: styles.warning.borderWidth,
        });
        page.drawText('!', {
          x: styles.page.margin + styles.warning.iconInset,
          y: y - styles.warning.iconYNudge,
          size: styles.warning.iconFontSize,
          font: helveticaBold,
          color: styles.colors.warningBorder,
        });

        const warningTextX = styles.page.margin + styles.warning.textInset;
        const warningTextWidth = maxContentWidth - styles.warning.horizontalPadding * 2;

        for (let wi = blockIdx; wi < endIdx; wi++) {
          const wBlock = blocks[wi];
          if (wBlock.type === 'bullet') {
            const bulletText = wBlock.cleanText.replace(/^[-•]\s*/, '');
            const bulletLines = splitLongStringToPageSize(
              bulletText,
              helvetica,
              styles.fontSize.body,
              warningTextWidth - styles.warning.bulletIndent
            );
            for (let i = 0; i < bulletLines.length; i++) {
              if (i === 0) {
                page.drawCircle({
                  x: warningTextX + styles.warning.bulletDotOffset,
                  y: y + styles.fontSize.body * styles.bullet.dotVerticalRatio,
                  size: styles.warning.bulletDotRadius,
                  color: styles.colors.warningBorder,
                });
              }
              page.drawText(bulletLines[i], {
                x: warningTextX + styles.warning.bulletTextOffset,
                y,
                size: styles.fontSize.body,
                font: helvetica,
                color: styles.colors.textDark,
              });
              y -= bodyLineHeight;
            }
          } else {
            const lines = splitLongStringToPageSize(
              wBlock.cleanText,
              helvetica,
              styles.fontSize.body,
              warningTextWidth
            );
            for (const line of lines) {
              page.drawText(line, {
                x: warningTextX,
                y,
                size: styles.fontSize.body,
                font: helvetica,
                color: styles.colors.textDark,
              });
              y -= bodyLineHeight;
            }
          }
        }

        y -= 4;
        blockIdx = endIdx;
      } else {
        const lines = splitLongStringToPageSize(block.cleanText, helvetica, styles.fontSize.body, maxContentWidth);
        for (const line of lines) {
          if (y < styles.page.margin + styles.pagination.bottomSafeZone) {
            page = pdfDoc.addPage([styles.page.width, styles.page.height]);
            allPages.push({ page, icdLabel });
            y = styles.page.height - styles.page.margin;
          }
          page.drawText(line, {
            x: styles.page.margin,
            y,
            size: styles.fontSize.body,
            font: helvetica,
            color: styles.colors.textDark,
          });
          y -= bodyLineHeight;
        }
        blockIdx++;
      }
    }
  }

  const totalPages = allPages.length;
  allPages.forEach(({ page, icdLabel }, idx) => drawFooter(page, idx + 1, totalPages, icdLabel));

  return pdfDoc.save();
}
