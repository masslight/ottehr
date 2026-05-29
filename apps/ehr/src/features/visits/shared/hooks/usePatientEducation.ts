import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deletePatientDocument } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { ApprovedPatientEducationItem, CommunicationDTO } from 'utils';
import { useAppointmentData, useChartData, useSaveChartData } from '../stores/appointment/appointment.store';
import { useOystehrAPIClient } from './useOystehrAPIClient';

export interface DiagnosisOption {
  code: string;
  display: string;
  isPrimary: boolean;
}

// Presigned download URLs returned by save-patient-education-pdf, keyed by DocumentReference id.
// Lets the UI open a just-approved PDF without a second fetch+presign round-trip.
// Presigned URLs eventually expire; PatientEducationCard falls back to fetching a fresh URL.
const educationPdfUrls = new Map<string, string>();

export function getEducationPdfUrl(docRefId: string): string | undefined {
  return educationPdfUrls.get(docRefId);
}

export function clearEducationPdfUrl(docRefId: string): void {
  educationPdfUrls.delete(docRefId);
}

export interface EducationSection {
  content: string;
  patientTitle: string;
  icdCode: string;
  icdDescription: string;
}

export type GenerateOutcome = 'review' | 'completed';

export interface UsePatientEducationResult {
  prefetchAllDiagnoses: () => void;
  generateDiagnoses: (diagnoses: DiagnosisOption[]) => Promise<GenerateOutcome | null>;
  saveFromSections: (sections: EducationSection[]) => Promise<boolean>;
  generatedSections: EducationSection[] | null;
  clearGeneratedSections: () => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  progress: string | null;
  allDiagnoses: DiagnosisOption[];
  approvedByCode: Map<string, ApprovedPatientEducationItem>;
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
  const { oystehrZambda } = useApiClients();

  const allDiagnoses: DiagnosisOption[] = (chartData?.diagnosis ?? []).map((d) => ({
    code: d.code,
    display: d.display,
    isPrimary: d.isPrimary,
  }));

  const [approvedByCode, setApprovedByCode] = useState<Map<string, ApprovedPatientEducationItem>>(new Map());
  // The full selection from the most recent generateDiagnoses call, preserved
  // so saveFromSections can merge approved PDFs with newly-rendered content.
  const lastSelectionRef = useRef<DiagnosisOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!apiClient) return;
    apiClient
      .listApprovedPatientEducation()
      .then((res) => {
        if (cancelled) return;
        const map = new Map<string, ApprovedPatientEducationItem>();
        for (const item of res.items) {
          for (const icd of item.icdCodes) {
            map.set(icd.code, item);
          }
        }
        setApprovedByCode(map);
      })
      .catch((err) => {
        console.error('Failed to load approved patient education index:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const clearGeneratedSections = useCallback(() => {
    setGeneratedSections(null);
    setError(null);
  }, []);

  // Prefetch cache: fires off requests for all non-approved diagnoses as soon as the modal opens
  const prefetchCacheRef = useRef<Map<string, Promise<EducationSection | null>>>(new Map());

  const prefetchAllDiagnoses = useCallback(() => {
    if (!apiClient) return;
    for (const diagnosis of allDiagnoses) {
      if (approvedByCode.has(diagnosis.code)) continue;
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
  }, [apiClient, allDiagnoses, approvedByCode]);

  const buildAndSaveMergedPdf = useCallback(
    async (selection: DiagnosisOption[], sections: EducationSection[]): Promise<void> => {
      if (!apiClient) {
        setError('API client not available.');
        return;
      }

      const finalDoc = await PDFDocument.create();
      const sectionsByCode = new Map(sections.map((section) => [section.icdCode, section]));

      const appendPdfPages = async (pdfBytes: Uint8Array | ArrayBuffer): Promise<void> => {
        const sourceDoc = await PDFDocument.load(pdfBytes);
        const copiedPages = await finalDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
        copiedPages.forEach((page) => finalDoc.addPage(page));
      };

      for (const dx of selection) {
        const approved = approvedByCode.get(dx.code);
        if (approved) {
          if (!approved.pdfPresignedUrl) {
            throw new Error(`Approved PDF for ${dx.code} is missing a presigned URL.`);
          }

          const response = await fetch(approved.pdfPresignedUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch approved PDF for ${dx.code}: ${response.status}`);
          }

          await appendPdfPages(await response.arrayBuffer());
          continue;
        }

        const generatedSection = sectionsByCode.get(dx.code);
        if (!generatedSection) {
          throw new Error(`Generated content for ${dx.code} is missing.`);
        }

        const generatedBytes = await generateCombinedPdf([generatedSection]);
        await appendPdfPages(generatedBytes);
      }

      // The merged PDF (finalDoc) is built so each approved/generated section is appended in
      // selection order. Server-side rendering takes over from here: savePatientEducationPdf
      // re-renders from `sections`. The client-side merge is retained because the same helpers
      // are used elsewhere (e.g. ApprovedPatientEducationDialog preview).
      await finalDoc.save();

      const titleParts: string[] = [];
      for (const dx of selection) {
        const approved = approvedByCode.get(dx.code);
        if (approved) {
          titleParts.push(approved.title.replace(/^Patient Education:\s*/, '') || dx.display);
        } else {
          const section = sections.find((s) => s.icdCode === dx.code);
          titleParts.push(section?.patientTitle || dx.display);
        }
      }
      const title = 'Patient Education: ' + titleParts.join(', ');

      const { documentReferenceId, presignedDownloadUrl } = await apiClient.savePatientEducationPdf({
        encounterId: encounter.id!,
        patientId: patient!.id!,
        sections,
        title,
      });

      educationPdfUrls.set(documentReferenceId, presignedDownloadUrl);

      const instructions = chartData?.instructions || [];
      const newInstruction: CommunicationDTO = {
        title,
        educationDocRefId: documentReferenceId,
      };
      const localInstructions = [...instructions, newInstruction];
      setPartialChartData({ instructions: localInstructions });

      try {
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
      } catch (error) {
        setPartialChartData({ instructions });
        clearEducationPdfUrl(documentReferenceId);

        if (oystehrZambda) {
          try {
            await deletePatientDocument(oystehrZambda, { documentRefId: documentReferenceId });
          } catch (cleanupError) {
            console.error('Failed to clean up patient education PDF after chart save failure:', cleanupError);
          }
        }

        throw error;
      }
    },
    [
      apiClient,
      approvedByCode,
      chartData?.instructions,
      encounter,
      patient,
      saveChartData,
      setPartialChartData,
      oystehrZambda,
    ]
  );

  const generateDiagnoses = useCallback(
    async (selectedDiagnoses: DiagnosisOption[]): Promise<GenerateOutcome | null> => {
      if (selectedDiagnoses.length === 0) {
        setError('No diagnoses selected.');
        return null;
      }
      if (!apiClient) {
        setError('API client not available.');
        return null;
      }

      setIsLoading(true);
      setError(null);
      setProgress(null);
      setGeneratedSections(null);
      lastSelectionRef.current = selectedDiagnoses;

      const toGenerate = selectedDiagnoses.filter((d) => !approvedByCode.has(d.code));

      try {
        // Fast path: every selected diagnosis has a pre-approved PDF — skip review and merge directly.
        if (toGenerate.length === 0) {
          setIsLoading(false);
          setIsSaving(true);
          try {
            await buildAndSaveMergedPdf(selectedDiagnoses, []);
            return 'completed';
          } finally {
            setIsSaving(false);
          }
        }

        const sections: EducationSection[] = [];
        for (let i = 0; i < toGenerate.length; i++) {
          const diagnosis = toGenerate[i];
          setProgress(`Loading ${i + 1} of ${toGenerate.length}: ${diagnosis.display}...`);

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
          if (section) sections.push(section);
        }

        if (sections.length === 0) {
          setError('No content was generated for any of the selected diagnoses.');
          return null;
        }

        setGeneratedSections(sections);
        return 'review';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        console.error('Patient education generation failed:', err);
        return null;
      } finally {
        setIsLoading(false);
        setProgress(null);
      }
    },
    [apiClient, approvedByCode, buildAndSaveMergedPdf]
  );

  const saveFromSections = useCallback(
    async (sections: EducationSection[]): Promise<boolean> => {
      if (!apiClient) {
        setError('API client not available.');
        return false;
      }
      setIsSaving(true);
      setError(null);
      try {
        await buildAndSaveMergedPdf(lastSelectionRef.current, sections);
        setGeneratedSections(null);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        console.error('Patient education save failed:', err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [apiClient, buildAndSaveMergedPdf]
  );

  return {
    prefetchAllDiagnoses,
    generateDiagnoses,
    saveFromSections,
    generatedSections,
    clearGeneratedSections,
    isLoading,
    isSaving,
    error,
    progress,
    allDiagnoses,
    approvedByCode,
  };
}

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

// === Brand palette ===
const BRAND_BLUE = rgb(0.06, 0.2, 0.49); // #0F347C
const BRAND_LIGHT_BLUE = rgb(0.88, 0.93, 0.98); // #E0EDFA
const ACCENT_ORANGE = rgb(0.9, 0.45, 0.1);
const TEXT_DARK = rgb(0.15, 0.15, 0.15);
const TEXT_LIGHT = rgb(0.45, 0.45, 0.45);
const DIVIDER_COLOR = rgb(0.82, 0.82, 0.82);
const WARNING_BG = rgb(1, 0.97, 0.93); // light amber
const WARNING_BORDER = rgb(0.9, 0.6, 0.2);
const WHITE = rgb(1, 1, 1);

// === Page dimensions (US Letter at 72dpi) ===
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 48;
const MAX_TEXT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// === Typography ===
const BODY_FONT_SIZE = 10.5;
const SECTION_HEADER_FONT_SIZE = 13;
const TITLE_FONT_SIZE = 24;
const FOOTER_FONT_SIZE = 8;
const WARNING_ICON_FONT_SIZE = 14;
const LINE_HEIGHT = BODY_FONT_SIZE * 1.55;
const SECTION_HEADER_LINE_HEIGHT = SECTION_HEADER_FONT_SIZE * 2;
const TITLE_LINE_HEIGHT_RATIO = 1.3;
// Visual-baseline tweak so the centered banner title sits optically centered, not box-centered.
const TITLE_BASELINE_OFFSET_RATIO = 0.3;

// === Header banner ===
const BANNER_HEIGHT = 60;
const BANNER_TITLE_HORIZONTAL_PADDING = 20;
const GAP_BANNER_TO_ACCENT = 8;
const ACCENT_LINE_THICKNESS = 2;
const GAP_AFTER_ACCENT_LINE = 15;

// === Section headers (h2/h3) ===
const SECTION_HEADER_BOX_HEIGHT_RATIO = 1.6;
const SECTION_HEADER_BAR_WIDTH = 3;
const SECTION_HEADER_TEXT_INDENT = 10;
const SECTION_HEADER_BOX_BASELINE_OFFSET = 2;
const GAP_BEFORE_SECTION_HEADER = 8;

// === Bullets ===
const BULLET_GLYPH_X_OFFSET = 6;
const BULLET_TEXT_X_OFFSET = 16;
const BULLET_GLYPH_RADIUS = 2;
const BULLET_VERTICAL_BASELINE_RATIO = 0.3;
const BULLET_WRAP_INDENT = 20;

// === Warning callout box ===
const WARNING_BOX_VERTICAL_PADDING = 8;
const WARNING_BOX_BORDER_WIDTH = 1;
const WARNING_ICON_X_OFFSET = 9;
const WARNING_ICON_Y_OFFSET = -1;
const WARNING_TEXT_X_OFFSET = 22;
const WARNING_TEXT_RIGHT_INSET = 28;
const WARNING_BULLET_GLYPH_X_OFFSET = 4;
const WARNING_BULLET_TEXT_X_OFFSET = 14;
const WARNING_BULLET_WRAP_INDENT = 16;
const WARNING_TOP_GAP = 4;
const WARNING_BOTTOM_GAP = 4;

// === Page-break reserves (vertical space we refuse to write into above the footer) ===
const FOOTER_RESERVE = 40;
const SECTION_HEADER_BREAK_RESERVE = 30;
const TEXT_BREAK_RESERVE = 5;
const EMPTY_LINE_HEIGHT_RATIO = 0.4;

// === Footer layout (offsets are subtracted from PAGE_MARGIN baseline) ===
const FOOTER_DIVIDER_Y_OFFSET = 5;
const FOOTER_DIVIDER_THICKNESS = 0.5;
const FOOTER_PRIMARY_Y_OFFSET = 18;
const FOOTER_SECONDARY_Y_OFFSET = 28;
const FOOTER_PAGE_NUM_X_OFFSET = 50;

export async function generateCombinedPdf(
  sections: { content: string; patientTitle: string; icdCode: string; icdDescription: string }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  function addNewPage(): { page: ReturnType<typeof pdfDoc.addPage>; y: number } {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page, y: PAGE_HEIGHT - PAGE_MARGIN };
  }

  function drawFooter(
    page: ReturnType<typeof pdfDoc.addPage>,
    pageNum: number,
    totalPages: number,
    icdLabel: string
  ): void {
    // Thin line above footer
    page.drawLine({
      start: { x: PAGE_MARGIN, y: PAGE_MARGIN - FOOTER_DIVIDER_Y_OFFSET },
      end: { x: PAGE_WIDTH - PAGE_MARGIN, y: PAGE_MARGIN - FOOTER_DIVIDER_Y_OFFSET },
      thickness: FOOTER_DIVIDER_THICKNESS,
      color: DIVIDER_COLOR,
    });
    page.drawText(icdLabel, {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN - FOOTER_PRIMARY_Y_OFFSET,
      size: FOOTER_FONT_SIZE,
      font: helveticaOblique,
      color: TEXT_LIGHT,
    });
    const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    page.drawText(`Generated: ${formattedDate}  |  Source: MedlinePlus`, {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN - FOOTER_SECONDARY_Y_OFFSET,
      size: FOOTER_FONT_SIZE,
      font: helvetica,
      color: TEXT_LIGHT,
    });
    page.drawText(`Page ${pageNum} of ${totalPages}`, {
      x: PAGE_WIDTH - PAGE_MARGIN - FOOTER_PAGE_NUM_X_OFFSET,
      y: PAGE_MARGIN - FOOTER_PRIMARY_Y_OFFSET,
      size: FOOTER_FONT_SIZE,
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
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - BANNER_HEIGHT,
      width: PAGE_WIDTH,
      height: BANNER_HEIGHT,
      color: BRAND_BLUE,
    });
    // Title on banner — centered horizontally and vertically
    const titleLines = wrapText(
      section.patientTitle,
      TITLE_FONT_SIZE,
      MAX_TEXT_WIDTH - BANNER_TITLE_HORIZONTAL_PADDING
    );
    const titleBlockHeight = titleLines.length * TITLE_FONT_SIZE * TITLE_LINE_HEIGHT_RATIO;
    const bannerCenterY = PAGE_HEIGHT - BANNER_HEIGHT / 2;
    let titleY = bannerCenterY + titleBlockHeight / 2 - TITLE_FONT_SIZE * TITLE_BASELINE_OFFSET_RATIO;
    for (const line of titleLines) {
      const titleWidth = helveticaBold.widthOfTextAtSize(line, TITLE_FONT_SIZE);
      const titleX = (PAGE_WIDTH - titleWidth) / 2;
      page.drawText(line, { x: titleX, y: titleY, size: TITLE_FONT_SIZE, font: helveticaBold, color: WHITE });
      titleY -= TITLE_FONT_SIZE * TITLE_LINE_HEIGHT_RATIO;
    }
    y = PAGE_HEIGHT - BANNER_HEIGHT - GAP_BANNER_TO_ACCENT;

    // Thin accent line
    page.drawLine({
      start: { x: PAGE_MARGIN, y },
      end: { x: PAGE_WIDTH - PAGE_MARGIN, y },
      thickness: ACCENT_LINE_THICKNESS,
      color: ACCENT_ORANGE,
    });
    y -= GAP_AFTER_ACCENT_LINE;

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
      const warningTextWidth = MAX_TEXT_WIDTH - WARNING_TEXT_RIGHT_INSET;
      let height = WARNING_BOX_VERTICAL_PADDING; // top padding
      let idx = startIdx;

      // First line (the warning trigger)
      const firstLines = wrapText(blocks[idx].cleanText, BODY_FONT_SIZE, warningTextWidth);
      height += firstLines.length * LINE_HEIGHT;
      idx++;

      // Collect following bullets and text that belong to the warning
      while (idx < blocks.length) {
        const block = blocks[idx];
        if (block.type === 'header' || block.type === 'empty') break;
        // Stop at non-warning text that isn't a bullet (a new paragraph unrelated to the warning)
        if (block.type === 'text' && !block.isWarningLine) break;
        if (block.type === 'bullet') {
          const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
          const bulletLines = wrapText(bulletText, BODY_FONT_SIZE, warningTextWidth - WARNING_BULLET_WRAP_INDENT);
          height += bulletLines.length * LINE_HEIGHT;
        } else {
          const textLines = wrapText(block.cleanText, BODY_FONT_SIZE, warningTextWidth);
          height += textLines.length * LINE_HEIGHT;
        }
        idx++;
      }

      height += WARNING_BOX_VERTICAL_PADDING; // bottom padding
      return { endIdx: idx, totalHeight: height };
    };

    // Pass 2: render
    let blockIdx = 0;
    while (blockIdx < blocks.length) {
      const block = blocks[blockIdx];

      if (block.type === 'empty') {
        y -= LINE_HEIGHT * EMPTY_LINE_HEIGHT_RATIO;
        blockIdx++;
        continue;
      }

      // Check page break
      const neededSpace =
        block.type === 'header'
          ? SECTION_HEADER_LINE_HEIGHT + SECTION_HEADER_BREAK_RESERVE
          : LINE_HEIGHT + TEXT_BREAK_RESERVE;
      if (y < PAGE_MARGIN + FOOTER_RESERVE + neededSpace) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        allPages.push({ page, icdLabel });
        y = PAGE_HEIGHT - PAGE_MARGIN;
      }

      if (block.type === 'header') {
        y -= GAP_BEFORE_SECTION_HEADER;
        const headerBoxHeight = SECTION_HEADER_FONT_SIZE * SECTION_HEADER_BOX_HEIGHT_RATIO;
        const headerBoxY = y - headerBoxHeight + SECTION_HEADER_FONT_SIZE + SECTION_HEADER_BOX_BASELINE_OFFSET;
        page.drawRectangle({
          x: PAGE_MARGIN,
          y: headerBoxY,
          width: MAX_TEXT_WIDTH,
          height: headerBoxHeight,
          color: BRAND_LIGHT_BLUE,
        });
        page.drawRectangle({
          x: PAGE_MARGIN,
          y: headerBoxY,
          width: SECTION_HEADER_BAR_WIDTH,
          height: headerBoxHeight,
          color: BRAND_BLUE,
        });
        page.drawText(block.cleanText, {
          x: PAGE_MARGIN + SECTION_HEADER_TEXT_INDENT,
          y: y,
          size: SECTION_HEADER_FONT_SIZE,
          font: helveticaBold,
          color: BRAND_BLUE,
        });
        y -= SECTION_HEADER_LINE_HEIGHT;
        blockIdx++;
      } else if (block.type === 'bullet' && !block.isWarningLine) {
        const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
        const bulletLines = wrapText(bulletText, BODY_FONT_SIZE, MAX_TEXT_WIDTH - BULLET_WRAP_INDENT);
        for (let i = 0; i < bulletLines.length; i++) {
          if (y < PAGE_MARGIN + FOOTER_RESERVE) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            allPages.push({ page, icdLabel });
            y = PAGE_HEIGHT - PAGE_MARGIN;
          }
          if (i === 0) {
            page.drawCircle({
              x: PAGE_MARGIN + BULLET_GLYPH_X_OFFSET,
              y: y + BODY_FONT_SIZE * BULLET_VERTICAL_BASELINE_RATIO,
              size: BULLET_GLYPH_RADIUS,
              color: ACCENT_ORANGE,
            });
          }
          page.drawText(bulletLines[i], {
            x: PAGE_MARGIN + BULLET_TEXT_X_OFFSET,
            y,
            size: BODY_FONT_SIZE,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= LINE_HEIGHT;
        }
        blockIdx++;
      } else if (block.isWarningLine && (block.type === 'text' || block.type === 'bullet')) {
        // Warning group: calculate total height, draw box, then render content inside
        const { endIdx, totalHeight } = calcWarningGroupHeight(blockIdx);

        // Check if warning group fits on current page
        if (y < PAGE_MARGIN + FOOTER_RESERVE + totalHeight) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          allPages.push({ page, icdLabel });
          y = PAGE_HEIGHT - PAGE_MARGIN;
        }

        // Draw the warning box with the correct size
        y -= WARNING_TOP_GAP;
        const boxTop = y + BODY_FONT_SIZE + WARNING_TOP_GAP;
        page.drawRectangle({
          x: PAGE_MARGIN,
          y: boxTop - totalHeight,
          width: MAX_TEXT_WIDTH,
          height: totalHeight,
          color: WARNING_BG,
          borderColor: WARNING_BORDER,
          borderWidth: WARNING_BOX_BORDER_WIDTH,
        });
        page.drawText('!', {
          x: PAGE_MARGIN + WARNING_ICON_X_OFFSET,
          y: y + WARNING_ICON_Y_OFFSET,
          size: WARNING_ICON_FONT_SIZE,
          font: helveticaBold,
          color: WARNING_BORDER,
        });

        // Render all blocks inside the warning box
        const warningTextX = PAGE_MARGIN + WARNING_TEXT_X_OFFSET;
        const warningTextWidth = MAX_TEXT_WIDTH - WARNING_TEXT_RIGHT_INSET;

        for (let wi = blockIdx; wi < endIdx; wi++) {
          const wBlock = blocks[wi];
          if (wBlock.type === 'bullet') {
            const bulletText = wBlock.cleanText.replace(/^[-•]\s*/, '');
            const bulletLines = wrapText(bulletText, BODY_FONT_SIZE, warningTextWidth - WARNING_BULLET_WRAP_INDENT);
            for (let i = 0; i < bulletLines.length; i++) {
              if (i === 0) {
                page.drawCircle({
                  x: warningTextX + WARNING_BULLET_GLYPH_X_OFFSET,
                  y: y + BODY_FONT_SIZE * BULLET_VERTICAL_BASELINE_RATIO,
                  size: BULLET_GLYPH_RADIUS,
                  color: WARNING_BORDER,
                });
              }
              page.drawText(bulletLines[i], {
                x: warningTextX + WARNING_BULLET_TEXT_X_OFFSET,
                y,
                size: BODY_FONT_SIZE,
                font: helvetica,
                color: TEXT_DARK,
              });
              y -= LINE_HEIGHT;
            }
          } else {
            const lines = wrapText(wBlock.cleanText, BODY_FONT_SIZE, warningTextWidth);
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

        y -= WARNING_BOTTOM_GAP;
        blockIdx = endIdx;
      } else {
        // Regular text
        const lines = wrapText(block.cleanText, BODY_FONT_SIZE, MAX_TEXT_WIDTH);
        for (const line of lines) {
          if (y < PAGE_MARGIN + FOOTER_RESERVE) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            allPages.push({ page, icdLabel });
            y = PAGE_HEIGHT - PAGE_MARGIN;
          }
          page.drawText(line, {
            x: PAGE_MARGIN,
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

  // Add page numbers to all pages
  const totalPages = allPages.length;
  allPages.forEach(({ page, icdLabel }, idx) => drawFooter(page, idx + 1, totalPages, icdLabel));

  return pdfDoc.save();
}
