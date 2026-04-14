import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useCallback, useRef, useState } from 'react';
import { CommunicationDTO } from 'utils';
import { useAppointmentData, useChartData, useSaveChartData } from '../stores/appointment/appointment.store';
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

// Map of education doc ref IDs to blob URLs for the current session
const educationBlobUrls = new Map<string, string>();

export function getEducationBlobUrl(docRefId: string): string | undefined {
  return educationBlobUrls.get(docRefId);
}

export interface EducationSection {
  content: string;
  patientTitle: string;
  icdCode: string;
  icdDescription: string;
}

export interface UsePatientEducationResult {
  prefetchAllDiagnoses: () => void;
  generateForDiagnoses: (diagnoses: DiagnosisOption[]) => Promise<void>;
  saveFromSections: (sections: EducationSection[]) => Promise<void>;
  generatedSections: EducationSection[] | null;
  clearGeneratedSections: () => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  progress: string | null;
  allDiagnoses: DiagnosisOption[];
}

export function usePatientEducation(): UsePatientEducationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [generatedSections, setGeneratedSections] = useState<EducationSection[] | null>(null);
  const { chartData, setPartialChartData } = useChartData();
  const { encounter, patient } = useAppointmentData();
  const { mutateAsync: saveChartData } = useSaveChartData();
  const apiClient = useOystehrAPIClient();

  const allDiagnoses: DiagnosisOption[] = (chartData?.diagnosis ?? []).map((d) => ({
    code: d.code,
    display: d.display,
    isPrimary: d.isPrimary,
  }));

  const clearGeneratedSections = useCallback(() => {
    setGeneratedSections(null);
    setError(null);
  }, []);

  // Prefetch cache: fires off requests for all diagnoses as soon as the modal opens
  const prefetchCacheRef = useRef<Map<string, Promise<EducationSection | null>>>(new Map());

  const prefetchAllDiagnoses = useCallback(() => {
    if (!apiClient) return;
    for (const diagnosis of allDiagnoses) {
      if (prefetchCacheRef.current.has(diagnosis.code)) continue;
      const promise = apiClient
        .generatePatientEducation({
          icdCode: diagnosis.code,
          icdDescription: diagnosis.display,
        })
        .then((result): EducationSection | null =>
          result.content
            ? {
                content: result.content,
                patientTitle: result.patientTitle || diagnosis.display,
                icdCode: diagnosis.code,
                icdDescription: diagnosis.display,
              }
            : null
        )
        .catch((err) => {
          console.error(`Prefetch failed for ${diagnosis.code}:`, err);
          prefetchCacheRef.current.delete(diagnosis.code);
          return null;
        });
      prefetchCacheRef.current.set(diagnosis.code, promise);
    }
  }, [apiClient, allDiagnoses]);

  // Phase 1: Collect results from prefetch cache for selected diagnoses
  const generateForDiagnoses = useCallback(
    async (selectedDiagnoses: DiagnosisOption[]): Promise<void> => {
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
      setGeneratedSections(null);

      try {
        const sections: EducationSection[] = [];

        for (let i = 0; i < selectedDiagnoses.length; i++) {
          const diagnosis = selectedDiagnoses[i];
          setProgress(`Loading ${i + 1} of ${selectedDiagnoses.length}: ${diagnosis.display}...`);

          // Use prefetched result if available, otherwise fetch now
          let sectionPromise = prefetchCacheRef.current.get(diagnosis.code);
          if (!sectionPromise) {
            sectionPromise = apiClient
              .generatePatientEducation({
                icdCode: diagnosis.code,
                icdDescription: diagnosis.display,
              })
              .then((result): EducationSection | null =>
                result.content
                  ? {
                      content: result.content,
                      patientTitle: result.patientTitle || diagnosis.display,
                      icdCode: diagnosis.code,
                      icdDescription: diagnosis.display,
                    }
                  : null
              );
          }

          const section = await sectionPromise;
          if (section) {
            sections.push(section);
          }
        }

        if (sections.length === 0) {
          setError('No content was generated for any of the selected diagnoses.');
          return;
        }

        setGeneratedSections(sections);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        console.error('Patient education generation failed:', err);
      } finally {
        setIsLoading(false);
        setProgress(null);
      }
    },
    [apiClient]
  );

  // Phase 2: Build PDF from (possibly edited) sections, upload, and save as instruction
  const saveFromSections = useCallback(
    async (sections: EducationSection[]): Promise<void> => {
      if (!apiClient) {
        setError('API client not available.');
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        const pdfBytes = await generateCombinedPdf(sections);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        const pdfBase64 = btoa(
          Array.from(pdfBytes)
            .map((b) => String.fromCharCode(b))
            .join('')
        );
        const title = 'Patient Education: ' + sections.map((s) => s.patientTitle).join(', ');

        const { documentReferenceId } = await apiClient.savePatientEducationPdf({
          encounterId: encounter.id!,
          patientId: patient!.id!,
          pdfBase64,
          title,
        });

        educationBlobUrls.set(documentReferenceId, blobUrl);

        const instructions = chartData?.instructions || [];
        const newInstruction: CommunicationDTO = {
          title,
          educationDocRefId: documentReferenceId,
        };

        const localInstructions = [...instructions, newInstruction];
        setPartialChartData({ instructions: localInstructions });

        await saveChartData(
          { instructions: [newInstruction] },
          {
            onSuccess: (data) => {
              const saved = (data?.chartData?.instructions || [])[0];
              if (saved) {
                setPartialChartData({
                  instructions: localInstructions.map((item) =>
                    item.resourceId ? item : { ...saved, educationDocRefId: documentReferenceId }
                  ),
                });
              }
            },
            onError: () => {
              setPartialChartData({ instructions });
            },
          }
        );

        setGeneratedSections(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        console.error('Patient education save failed:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [apiClient, chartData?.instructions, encounter, patient, saveChartData, setPartialChartData]
  );

  return {
    prefetchAllDiagnoses,
    generateForDiagnoses,
    saveFromSections,
    generatedSections,
    clearGeneratedSections,
    isLoading,
    isSaving,
    error,
    progress,
    allDiagnoses,
  };
}

// Color constants
const BRAND_BLUE = rgb(0.06, 0.2, 0.49); // #0F347C
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
    // Thin line above footer
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

  // Track pages for footer numbering and ICD label
  const allPages: { page: ReturnType<typeof pdfDoc.addPage>; icdLabel: string }[] = [];

  for (const section of sections) {
    let { page, y } = addNewPage();
    const icdLabel = `${section.icdCode} — ${section.icdDescription}`;
    allPages.push({ page, icdLabel });

    // === Header banner ===
    const bannerHeight = 60;
    page.drawRectangle({
      x: 0,
      y: pageHeight - bannerHeight,
      width: pageWidth,
      height: bannerHeight,
      color: BRAND_BLUE,
    });
    // Title on banner — centered horizontally and vertically
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

    // Thin accent line
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 2,
      color: ACCENT_ORANGE,
    });
    y -= 15;

    // === Body content — two-pass approach for warning boxes ===
    // Pass 1: classify each paragraph into typed blocks
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

    // Pass 1.5: identify warning groups (a warning text line + following bullets/text until next header or non-warning gap)
    // and calculate their total height so we can draw a properly sized box
    const calcWarningGroupHeight = (startIdx: number): { endIdx: number; totalHeight: number } => {
      const warningTextWidth = maxWidth - 28;
      let height = 8; // top padding
      let idx = startIdx;

      // First line (the warning trigger)
      const firstLines = wrapText(blocks[idx].cleanText, bodyFontSize, warningTextWidth);
      height += firstLines.length * lineHeight;
      idx++;

      // Collect following bullets and text that belong to the warning
      while (idx < blocks.length) {
        const block = blocks[idx];
        if (block.type === 'header' || block.type === 'empty') break;
        // Stop at non-warning text that isn't a bullet (a new paragraph unrelated to the warning)
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

      height += 8; // bottom padding
      return { endIdx: idx, totalHeight: height };
    };

    // Pass 2: render
    let blockIdx = 0;
    while (blockIdx < blocks.length) {
      const block = blocks[blockIdx];

      if (block.type === 'empty') {
        y -= lineHeight * 0.4;
        blockIdx++;
        continue;
      }

      // Check page break
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
        // Warning group: calculate total height, draw box, then render content inside
        const { endIdx, totalHeight } = calcWarningGroupHeight(blockIdx);

        // Check if warning group fits on current page
        if (y < margin + 40 + totalHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          allPages.push({ page, icdLabel });
          y = pageHeight - margin;
        }

        // Draw the warning box with the correct size
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

        // Render all blocks inside the warning box
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

        y -= 4; // bottom padding after warning box
        blockIdx = endIdx;
      } else {
        // Regular text
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

  // Add page numbers to all pages
  const totalPages = allPages.length;
  allPages.forEach(({ page, icdLabel }, idx) => drawFooter(page, idx + 1, totalPages, icdLabel));

  return pdfDoc.save();
}
