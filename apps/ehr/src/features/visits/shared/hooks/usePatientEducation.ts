import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useState } from 'react';
import { useChartData } from '../stores/appointment/appointment.store';
import { useOystehrAPIClient } from './useOystehrAPIClient';

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

export interface DiagnosisOption {
  code: string;
  display: string;
  isPrimary: boolean;
}

export interface UsePatientEducationResult {
  generateForDiagnoses: (diagnoses: DiagnosisOption[]) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  progress: string | null;
  allDiagnoses: DiagnosisOption[];
}

export function usePatientEducation(): UsePatientEducationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const { chartData } = useChartData();
  const apiClient = useOystehrAPIClient();

  const allDiagnoses: DiagnosisOption[] = (chartData?.diagnosis ?? []).map((d) => ({
    code: d.code,
    display: d.display,
    isPrimary: d.isPrimary,
  }));

  const generateForDiagnoses = async (selectedDiagnoses: DiagnosisOption[]): Promise<void> => {
    if (selectedDiagnoses.length === 0) {
      setError('No diagnoses selected.');
      return;
    }
    if (!apiClient) {
      setError('API client not available.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Generate content for each selected diagnosis
      const sections: { content: string; patientTitle: string; icdCode: string; icdDescription: string }[] = [];

      for (let i = 0; i < selectedDiagnoses.length; i++) {
        const diagnosis = selectedDiagnoses[i];
        setProgress(`Generating ${i + 1} of ${selectedDiagnoses.length}: ${diagnosis.display}...`);

        const result = await apiClient.generatePatientEducation({
          icdCode: diagnosis.code,
          icdDescription: diagnosis.display,
        });

        if (result.content) {
          sections.push({
            content: result.content,
            patientTitle: result.patientTitle || diagnosis.display,
            icdCode: diagnosis.code,
            icdDescription: diagnosis.display,
          });
        }
      }

      if (sections.length === 0) {
        setError('No content was generated for any of the selected diagnoses.');
        return;
      }

      // Generate a single combined PDF
      setProgress('Building PDF...');
      const pdfBytes = await generateCombinedPdf(sections);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      console.error('Patient education generation failed:', err);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  return { generateForDiagnoses, isLoading, error, progress, allDiagnoses };
}

// Color constants
const BRAND_BLUE = rgb(0.13, 0.35, 0.6); // #214F99
const BRAND_LIGHT_BLUE = rgb(0.88, 0.93, 0.98); // #E0EDFA
const ACCENT_ORANGE = rgb(0.9, 0.45, 0.1);
const TEXT_DARK = rgb(0.15, 0.15, 0.15);
const TEXT_LIGHT = rgb(0.45, 0.45, 0.45);
const DIVIDER_COLOR = rgb(0.82, 0.82, 0.82);
const WARNING_BG = rgb(1, 0.97, 0.93); // light amber
const WARNING_BORDER = rgb(0.9, 0.6, 0.2);

async function generateCombinedPdf(
  sections: { content: string; patientTitle: string; icdCode: string; icdDescription: string }[]
): Promise<Uint8Array> {
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
  const titleFontSize = 20;
  const lineHeight = bodyFontSize * 1.55;
  const sectionHeaderLineHeight = sectionHeaderFontSize * 2;

  function addNewPage(): { page: ReturnType<typeof pdfDoc.addPage>; y: number } {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    return { page, y: pageHeight - margin };
  }

  function drawFooter(page: ReturnType<typeof pdfDoc.addPage>, pageNum: number, totalPages: number): void {
    // Thin line above footer
    page.drawLine({
      start: { x: margin, y: margin - 5 },
      end: { x: pageWidth - margin, y: margin - 5 },
      thickness: 0.5,
      color: DIVIDER_COLOR,
    });
    page.drawText('Source: MedlinePlus — U.S. National Library of Medicine', {
      x: margin,
      y: margin - 18,
      size: 8,
      font: helveticaOblique,
      color: TEXT_LIGHT,
    });
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
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

  // Track pages for footer numbering
  const allPages: ReturnType<typeof pdfDoc.addPage>[] = [];

  for (const section of sections) {
    let { page, y } = addNewPage();
    allPages.push(page);

    // === Header banner ===
    const bannerHeight = 60;
    page.drawRectangle({
      x: 0,
      y: pageHeight - bannerHeight,
      width: pageWidth,
      height: bannerHeight,
      color: BRAND_BLUE,
    });
    // Title on banner
    const titleLines = wrapText(section.patientTitle, titleFontSize, maxWidth - 20);
    let titleY = pageHeight - 22;
    for (const line of titleLines) {
      page.drawText(line, { x: margin + 4, y: titleY, size: titleFontSize, font: helveticaBold, color: rgb(1, 1, 1) });
      titleY -= titleFontSize * 1.3;
    }
    y = pageHeight - bannerHeight - 8;

    // ICD code subtitle below banner
    page.drawText(`${section.icdCode} — ${section.icdDescription}`, {
      x: margin,
      y,
      size: 9,
      font: helveticaOblique,
      color: TEXT_LIGHT,
    });
    y -= 20;

    // Thin accent line
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 2,
      color: ACCENT_ORANGE,
    });
    y -= 15;

    // === Body content ===
    const paragraphs = section.content.split('\n');
    let inWarningBox = false;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        y -= lineHeight * 0.4;
        continue;
      }

      // Detect section headers (## headers or ALL CAPS headers)
      const isH2 = /^##\s/.test(trimmed);
      const isH3 = /^###\s/.test(trimmed);
      const isAllCapsHeader = /^[A-Z][A-Z\s/()-]{3,}:?$/.test(trimmed) && !trimmed.includes('.');
      const isNumberedHeader = /^\d+\.\s+[A-Z]/.test(trimmed);
      const isHeader = isH2 || isH3 || isAllCapsHeader || isNumberedHeader;
      const isBullet = /^[-•]\s/.test(trimmed);
      const isWarningLine =
        /seek.*(?:emergency|immediate|urgent)|call\s+911|go\s+to\s+(?:the\s+)?(?:emergency|ER)/i.test(trimmed);

      const cleanText = trimmed.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '');

      // Check page break
      const neededSpace = isHeader ? sectionHeaderLineHeight + 30 : lineHeight + 5;
      if (y < margin + 40 + neededSpace) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        allPages.push(page);
        y = pageHeight - margin;
      }

      if (isHeader) {
        // End any warning box
        inWarningBox = false;
        y -= 8;

        // Section header with colored left border
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
        page.drawText(cleanText, {
          x: margin + 10,
          y: y,
          size: sectionHeaderFontSize,
          font: helveticaBold,
          color: BRAND_BLUE,
        });
        y -= sectionHeaderLineHeight;
      } else if (isBullet) {
        const bulletText = cleanText.replace(/^[-•]\s*/, '');
        const bulletLines = wrapText(bulletText, bodyFontSize, maxWidth - 20);
        for (let i = 0; i < bulletLines.length; i++) {
          if (y < margin + 40) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            allPages.push(page);
            y = pageHeight - margin;
          }
          if (i === 0) {
            // Bullet dot
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
      } else {
        // Check for warning/emergency content
        if (isWarningLine && !inWarningBox) {
          inWarningBox = true;
          // Draw warning box background (we'll extend it as lines are added)
          y -= 4;
          page.drawRectangle({
            x: margin,
            y: y - lineHeight * 2,
            width: maxWidth,
            height: lineHeight * 3,
            color: WARNING_BG,
            borderColor: WARNING_BORDER,
            borderWidth: 1,
          });
          page.drawText('!', { x: margin + 9, y: y - 1, size: 14, font: helveticaBold, color: WARNING_BORDER });
        }

        const textX = inWarningBox ? margin + 22 : margin;
        const textWidth = inWarningBox ? maxWidth - 28 : maxWidth;
        const lines = wrapText(cleanText, bodyFontSize, textWidth);
        for (const line of lines) {
          if (y < margin + 40) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            allPages.push(page);
            y = pageHeight - margin;
            inWarningBox = false;
          }
          page.drawText(line, {
            x: textX,
            y,
            size: bodyFontSize,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= lineHeight;
        }

        if (inWarningBox && !isWarningLine) {
          inWarningBox = false;
          y -= 4;
        }
      }
    }
  }

  // Add page numbers to all pages
  const totalPages = allPages.length;
  allPages.forEach((page, idx) => drawFooter(page, idx + 1, totalPages));

  return pdfDoc.save();
}
