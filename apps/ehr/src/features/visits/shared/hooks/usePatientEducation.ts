import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deletePatientDocument } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  ApprovedPatientEducationItem,
  CommunicationDTO,
  fitWrappedTextToBanner,
  PatientEducationLanguage,
} from 'utils';
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

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

export interface EducationSection {
  content: string;
  patientTitle: string;
  icdCode: string;
  icdDescription: string;
}

export type GenerateOutcome = 'review' | 'completed';

export interface UsePatientEducationResult {
  prefetchAllDiagnoses: (language: PatientEducationLanguage) => void;
  generateDiagnoses: (
    diagnoses: DiagnosisOption[],
    language: PatientEducationLanguage
  ) => Promise<GenerateOutcome | null>;
  saveFromSections: (sections: EducationSection[], language: PatientEducationLanguage) => Promise<boolean>;
  generatedSections: EducationSection[] | null;
  clearGeneratedSections: () => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  progress: string | null;
  allDiagnoses: DiagnosisOption[];
  approvedByCode: Map<string, ApprovedPatientEducationItem>;
  // Language to default the generate dialog to — the patient's preferred language when it's one we
  // support (Spanish), else English. The clinician can still change it (never auto-generates).
  defaultLanguage: PatientEducationLanguage;
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

  // Default the language selector to the patient's preferred language when it's one we support.
  const preferredLanguageCode = patient?.communication
    ?.find((c) => c.preferred)
    ?.language?.coding?.[0]?.code?.toLowerCase();
  const defaultLanguage: PatientEducationLanguage = preferredLanguageCode?.startsWith('es') ? 'es' : 'en';

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

  // Prefetch cache: fires off requests for all non-approved diagnoses as soon as the modal opens.
  // Keyed by `${code}:${language}` so switching language fetches the right-language content.
  const prefetchCacheRef = useRef<Map<string, Promise<EducationSection | null>>>(new Map());
  const cacheKey = (code: string, language: PatientEducationLanguage): string => `${code}:${language}`;

  const prefetchAllDiagnoses = useCallback(
    (language: PatientEducationLanguage) => {
      if (!apiClient) return;
      for (const diagnosis of allDiagnoses) {
        if (approvedByCode.has(diagnosis.code)) continue;
        const key = cacheKey(diagnosis.code, language);
        if (prefetchCacheRef.current.has(key)) continue;
        const promise = apiClient
          .generatePatientEducation({
            icdCode: diagnosis.code,
            icdDescription: diagnosis.display,
            language,
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
            prefetchCacheRef.current.delete(key);
            return null;
          });
        prefetchCacheRef.current.set(key, promise);
      }
    },
    [apiClient, allDiagnoses, approvedByCode]
  );

  const buildAndSaveMergedPdf = useCallback(
    async (
      selection: DiagnosisOption[],
      sections: EducationSection[],
      language: PatientEducationLanguage
    ): Promise<void> => {
      if (!apiClient) {
        setError('API client not available.');
        return;
      }

      const sectionsByCode = new Map(sections.map((section) => [section.icdCode, section]));
      const hasApprovedContent = selection.some((dx) => approvedByCode.has(dx.code));

      let mergedPdfBytes: Uint8Array | undefined;

      // Only merge client-side when at least one approved PDF is in play — otherwise the server
      // re-renders from `sections` and the client-side merge would be discarded work.
      if (hasApprovedContent) {
        const finalDoc = await PDFDocument.create();
        const appendedApprovedIds = new Set<string>();

        const appendPdfPages = async (pdfBytes: Uint8Array | ArrayBuffer): Promise<void> => {
          const sourceDoc = await PDFDocument.load(pdfBytes);
          const copiedPages = await finalDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
          copiedPages.forEach((page) => finalDoc.addPage(page));
        };

        for (const dx of selection) {
          const approved = approvedByCode.get(dx.code);
          if (approved) {
            // One approved item can cover multiple ICD codes; append each item only once.
            if (appendedApprovedIds.has(approved.documentReferenceId)) continue;
            appendedApprovedIds.add(approved.documentReferenceId);

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

        mergedPdfBytes = await finalDoc.save();
      }

      const titleParts: string[] = [];
      const titledApprovedIds = new Set<string>();
      for (const dx of selection) {
        const approved = approvedByCode.get(dx.code);
        if (approved) {
          if (titledApprovedIds.has(approved.documentReferenceId)) continue;
          titledApprovedIds.add(approved.documentReferenceId);
          titleParts.push(approved.title.replace(/^Patient Education:\s*/, '') || dx.display);
        } else {
          const section = sections.find((s) => s.icdCode === dx.code);
          titleParts.push(section?.patientTitle || dx.display);
        }
      }
      const title = 'Patient Education: ' + titleParts.join(', ');

      const { documentReferenceId, presignedDownloadUrl } = await apiClient.savePatientEducationPdf(
        mergedPdfBytes
          ? {
              encounterId: encounter.id!,
              patientId: patient!.id!,
              pdfBase64: uint8ArrayToBase64(mergedPdfBytes),
              title,
              language,
            }
          : {
              encounterId: encounter.id!,
              patientId: patient!.id!,
              sections,
              title,
              language,
            }
      );

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
    async (
      selectedDiagnoses: DiagnosisOption[],
      language: PatientEducationLanguage
    ): Promise<GenerateOutcome | null> => {
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
            await buildAndSaveMergedPdf(selectedDiagnoses, [], language);
            return 'completed';
          } finally {
            setIsSaving(false);
          }
        }

        const sections: EducationSection[] = [];
        for (let i = 0; i < toGenerate.length; i++) {
          const diagnosis = toGenerate[i];
          setProgress(`Loading ${i + 1} of ${toGenerate.length}: ${diagnosis.display}...`);

          let sectionPromise = prefetchCacheRef.current.get(cacheKey(diagnosis.code, language));
          if (!sectionPromise) {
            sectionPromise = apiClient
              .generatePatientEducation({
                icdCode: diagnosis.code,
                icdDescription: diagnosis.display,
                language,
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
    async (sections: EducationSection[], language: PatientEducationLanguage): Promise<boolean> => {
      if (!apiClient) {
        setError('API client not available.');
        return false;
      }
      setIsSaving(true);
      setError(null);
      try {
        await buildAndSaveMergedPdf(lastSelectionRef.current, sections, language);
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
    defaultLanguage,
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
const PAGE = {
  WIDTH: 612,
  HEIGHT: 792,
  MARGIN: 48,
  MAX_TEXT_WIDTH: 612 - 48 * 2, // WIDTH - MARGIN * 2
} as const;

// === Typography ===
const TYPOGRAPHY = {
  BODY_FONT_SIZE: 10.5,
  SECTION_HEADER_FONT_SIZE: 13,
  TITLE_FONT_SIZE: 24,
  FOOTER_FONT_SIZE: 8,
  WARNING_ICON_FONT_SIZE: 14,
  LINE_HEIGHT: 10.5 * 1.55, // BODY_FONT_SIZE * 1.55
  SECTION_HEADER_LINE_HEIGHT: 13 * 2, // SECTION_HEADER_FONT_SIZE * 2
  TITLE_LINE_HEIGHT_RATIO: 1.3,
  TITLE_MIN_FONT_SIZE: 18,
} as const;

// === Header banner ===
const BANNER = {
  HEIGHT: 80,
  TITLE_HORIZONTAL_PADDING: 20,
  TITLE_VERTICAL_PADDING: 10,
  TITLE_MAX_LINES: 3,
  GAP_TO_ACCENT: 8,
  ACCENT_LINE_THICKNESS: 2,
  GAP_AFTER_ACCENT: 15,
} as const;

// === Section headers (h2/h3) ===
const SECTION_HEADER = {
  BOX_HEIGHT_RATIO: 1.6,
  BAR_WIDTH: 3,
  TEXT_INDENT: 10,
  BOX_BASELINE_OFFSET: 2,
  GAP_BEFORE: 8,
} as const;

// === Bullets ===
const BULLET = {
  GLYPH_X_OFFSET: 6,
  TEXT_X_OFFSET: 16,
  GLYPH_RADIUS: 2,
  VERTICAL_BASELINE_RATIO: 0.3,
  WRAP_INDENT: 20,
} as const;

// === Warning callout box ===
const WARNING = {
  BOX_VERTICAL_PADDING: 8,
  BOX_BORDER_WIDTH: 1,
  ICON_X_OFFSET: 9,
  ICON_Y_OFFSET: -1,
  TEXT_X_OFFSET: 22,
  TEXT_RIGHT_INSET: 28,
  BULLET_GLYPH_X_OFFSET: 4,
  BULLET_TEXT_X_OFFSET: 14,
  BULLET_WRAP_INDENT: 16,
  TOP_GAP: 4,
  BOTTOM_GAP: 4,
} as const;

// === Page-break reserves (vertical space we refuse to write into above the footer) ===
const PAGE_BREAK = {
  FOOTER_RESERVE: 40,
  SECTION_HEADER_RESERVE: 30,
  TEXT_RESERVE: 5,
  EMPTY_LINE_HEIGHT_RATIO: 0.4,
} as const;

// === Footer layout (offsets are subtracted from PAGE.MARGIN baseline) ===
const FOOTER = {
  DIVIDER_Y_OFFSET: 5,
  DIVIDER_THICKNESS: 0.5,
  PRIMARY_Y_OFFSET: 18,
  SECONDARY_Y_OFFSET: 28,
  PAGE_NUM_X_OFFSET: 50,
} as const;

export async function generateCombinedPdf(
  sections: { content: string; patientTitle: string; icdCode: string; icdDescription: string }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  function addNewPage(): { page: ReturnType<typeof pdfDoc.addPage>; y: number } {
    const page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
    return { page, y: PAGE.HEIGHT - PAGE.MARGIN };
  }

  function drawFooter(
    page: ReturnType<typeof pdfDoc.addPage>,
    pageNum: number,
    totalPages: number,
    icdLabel: string
  ): void {
    // Thin line above footer
    page.drawLine({
      start: { x: PAGE.MARGIN, y: PAGE.MARGIN - FOOTER.DIVIDER_Y_OFFSET },
      end: { x: PAGE.WIDTH - PAGE.MARGIN, y: PAGE.MARGIN - FOOTER.DIVIDER_Y_OFFSET },
      thickness: FOOTER.DIVIDER_THICKNESS,
      color: DIVIDER_COLOR,
    });
    page.drawText(icdLabel, {
      x: PAGE.MARGIN,
      y: PAGE.MARGIN - FOOTER.PRIMARY_Y_OFFSET,
      size: TYPOGRAPHY.FOOTER_FONT_SIZE,
      font: helveticaOblique,
      color: TEXT_LIGHT,
    });
    const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    page.drawText(`Generated: ${formattedDate}  |  Source: MedlinePlus`, {
      x: PAGE.MARGIN,
      y: PAGE.MARGIN - FOOTER.SECONDARY_Y_OFFSET,
      size: TYPOGRAPHY.FOOTER_FONT_SIZE,
      font: helvetica,
      color: TEXT_LIGHT,
    });
    page.drawText(`Page ${pageNum} of ${totalPages}`, {
      x: PAGE.WIDTH - PAGE.MARGIN - FOOTER.PAGE_NUM_X_OFFSET,
      y: PAGE.MARGIN - FOOTER.PRIMARY_Y_OFFSET,
      size: TYPOGRAPHY.FOOTER_FONT_SIZE,
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
      y: PAGE.HEIGHT - BANNER.HEIGHT,
      width: PAGE.WIDTH,
      height: BANNER.HEIGHT,
      color: BRAND_BLUE,
    });
    const fittedTitle = fitWrappedTextToBanner({
      text: section.patientTitle,
      font: helveticaBold,
      maxWidth: PAGE.MAX_TEXT_WIDTH - BANNER.TITLE_HORIZONTAL_PADDING,
      initialFontSize: TYPOGRAPHY.TITLE_FONT_SIZE,
      minFontSize: TYPOGRAPHY.TITLE_MIN_FONT_SIZE,
      lineHeightRatio: TYPOGRAPHY.TITLE_LINE_HEIGHT_RATIO,
      bannerHeight: BANNER.HEIGHT,
      verticalPadding: BANNER.TITLE_VERTICAL_PADDING,
      maxLines: BANNER.TITLE_MAX_LINES,
    });
    const bannerCenterY = PAGE.HEIGHT - BANNER.HEIGHT / 2;
    let titleY = bannerCenterY + fittedTitle.blockHeight / 2 - fittedTitle.ascender;
    for (const line of fittedTitle.lines) {
      const titleWidth = helveticaBold.widthOfTextAtSize(line, fittedTitle.fontSize);
      const titleX = (PAGE.WIDTH - titleWidth) / 2;
      page.drawText(line, {
        x: titleX,
        y: titleY,
        size: fittedTitle.fontSize,
        font: helveticaBold,
        color: WHITE,
      });
      titleY -= fittedTitle.lineHeight;
    }
    y = PAGE.HEIGHT - BANNER.HEIGHT - BANNER.GAP_TO_ACCENT;

    // Thin accent line
    page.drawLine({
      start: { x: PAGE.MARGIN, y },
      end: { x: PAGE.WIDTH - PAGE.MARGIN, y },
      thickness: BANNER.ACCENT_LINE_THICKNESS,
      color: ACCENT_ORANGE,
    });
    y -= BANNER.GAP_AFTER_ACCENT;

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
      const warningTextWidth = PAGE.MAX_TEXT_WIDTH - WARNING.TEXT_RIGHT_INSET;
      let height = WARNING.BOX_VERTICAL_PADDING; // top padding
      let idx = startIdx;

      // First line (the warning trigger)
      const firstLines = wrapText(blocks[idx].cleanText, TYPOGRAPHY.BODY_FONT_SIZE, warningTextWidth);
      height += firstLines.length * TYPOGRAPHY.LINE_HEIGHT;
      idx++;

      // Collect following bullets and text that belong to the warning
      while (idx < blocks.length) {
        const block = blocks[idx];
        if (block.type === 'header' || block.type === 'empty') break;
        // Stop at non-warning text that isn't a bullet (a new paragraph unrelated to the warning)
        if (block.type === 'text' && !block.isWarningLine) break;
        if (block.type === 'bullet') {
          const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
          const bulletLines = wrapText(
            bulletText,
            TYPOGRAPHY.BODY_FONT_SIZE,
            warningTextWidth - WARNING.BULLET_WRAP_INDENT
          );
          height += bulletLines.length * TYPOGRAPHY.LINE_HEIGHT;
        } else {
          const textLines = wrapText(block.cleanText, TYPOGRAPHY.BODY_FONT_SIZE, warningTextWidth);
          height += textLines.length * TYPOGRAPHY.LINE_HEIGHT;
        }
        idx++;
      }

      height += WARNING.BOX_VERTICAL_PADDING; // bottom padding
      return { endIdx: idx, totalHeight: height };
    };

    // Pass 2: render
    let blockIdx = 0;
    while (blockIdx < blocks.length) {
      const block = blocks[blockIdx];

      if (block.type === 'empty') {
        y -= TYPOGRAPHY.LINE_HEIGHT * PAGE_BREAK.EMPTY_LINE_HEIGHT_RATIO;
        blockIdx++;
        continue;
      }

      // Check page break
      const neededSpace =
        block.type === 'header'
          ? TYPOGRAPHY.SECTION_HEADER_LINE_HEIGHT + PAGE_BREAK.SECTION_HEADER_RESERVE
          : TYPOGRAPHY.LINE_HEIGHT + PAGE_BREAK.TEXT_RESERVE;
      if (y < PAGE.MARGIN + PAGE_BREAK.FOOTER_RESERVE + neededSpace) {
        page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
        allPages.push({ page, icdLabel });
        y = PAGE.HEIGHT - PAGE.MARGIN;
      }

      if (block.type === 'header') {
        y -= SECTION_HEADER.GAP_BEFORE;
        const headerBoxHeight = TYPOGRAPHY.SECTION_HEADER_FONT_SIZE * SECTION_HEADER.BOX_HEIGHT_RATIO;
        const headerBoxY =
          y - headerBoxHeight + TYPOGRAPHY.SECTION_HEADER_FONT_SIZE + SECTION_HEADER.BOX_BASELINE_OFFSET;
        page.drawRectangle({
          x: PAGE.MARGIN,
          y: headerBoxY,
          width: PAGE.MAX_TEXT_WIDTH,
          height: headerBoxHeight,
          color: BRAND_LIGHT_BLUE,
        });
        page.drawRectangle({
          x: PAGE.MARGIN,
          y: headerBoxY,
          width: SECTION_HEADER.BAR_WIDTH,
          height: headerBoxHeight,
          color: BRAND_BLUE,
        });
        page.drawText(block.cleanText, {
          x: PAGE.MARGIN + SECTION_HEADER.TEXT_INDENT,
          y: y,
          size: TYPOGRAPHY.SECTION_HEADER_FONT_SIZE,
          font: helveticaBold,
          color: BRAND_BLUE,
        });
        y -= TYPOGRAPHY.SECTION_HEADER_LINE_HEIGHT;
        blockIdx++;
      } else if (block.type === 'bullet' && !block.isWarningLine) {
        const bulletText = block.cleanText.replace(/^[-•]\s*/, '');
        const bulletLines = wrapText(bulletText, TYPOGRAPHY.BODY_FONT_SIZE, PAGE.MAX_TEXT_WIDTH - BULLET.WRAP_INDENT);
        for (let i = 0; i < bulletLines.length; i++) {
          if (y < PAGE.MARGIN + PAGE_BREAK.FOOTER_RESERVE) {
            page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
            allPages.push({ page, icdLabel });
            y = PAGE.HEIGHT - PAGE.MARGIN;
          }
          if (i === 0) {
            page.drawCircle({
              x: PAGE.MARGIN + BULLET.GLYPH_X_OFFSET,
              y: y + TYPOGRAPHY.BODY_FONT_SIZE * BULLET.VERTICAL_BASELINE_RATIO,
              size: BULLET.GLYPH_RADIUS,
              color: ACCENT_ORANGE,
            });
          }
          page.drawText(bulletLines[i], {
            x: PAGE.MARGIN + BULLET.TEXT_X_OFFSET,
            y,
            size: TYPOGRAPHY.BODY_FONT_SIZE,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= TYPOGRAPHY.LINE_HEIGHT;
        }
        blockIdx++;
      } else if (block.isWarningLine && (block.type === 'text' || block.type === 'bullet')) {
        // Warning group: calculate total height, draw box, then render content inside
        const { endIdx, totalHeight } = calcWarningGroupHeight(blockIdx);

        // Check if warning group fits on current page
        if (y < PAGE.MARGIN + PAGE_BREAK.FOOTER_RESERVE + totalHeight) {
          page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
          allPages.push({ page, icdLabel });
          y = PAGE.HEIGHT - PAGE.MARGIN;
        }

        // Draw the warning box with the correct size
        y -= WARNING.TOP_GAP;
        const boxTop = y + TYPOGRAPHY.BODY_FONT_SIZE + WARNING.TOP_GAP;
        page.drawRectangle({
          x: PAGE.MARGIN,
          y: boxTop - totalHeight,
          width: PAGE.MAX_TEXT_WIDTH,
          height: totalHeight,
          color: WARNING_BG,
          borderColor: WARNING_BORDER,
          borderWidth: WARNING.BOX_BORDER_WIDTH,
        });
        page.drawText('!', {
          x: PAGE.MARGIN + WARNING.ICON_X_OFFSET,
          y: y + WARNING.ICON_Y_OFFSET,
          size: TYPOGRAPHY.WARNING_ICON_FONT_SIZE,
          font: helveticaBold,
          color: WARNING_BORDER,
        });

        // Render all blocks inside the warning box
        const warningTextX = PAGE.MARGIN + WARNING.TEXT_X_OFFSET;
        const warningTextWidth = PAGE.MAX_TEXT_WIDTH - WARNING.TEXT_RIGHT_INSET;

        for (let wi = blockIdx; wi < endIdx; wi++) {
          const wBlock = blocks[wi];
          if (wBlock.type === 'bullet') {
            const bulletText = wBlock.cleanText.replace(/^[-•]\s*/, '');
            const bulletLines = wrapText(
              bulletText,
              TYPOGRAPHY.BODY_FONT_SIZE,
              warningTextWidth - WARNING.BULLET_WRAP_INDENT
            );
            for (let i = 0; i < bulletLines.length; i++) {
              if (i === 0) {
                page.drawCircle({
                  x: warningTextX + WARNING.BULLET_GLYPH_X_OFFSET,
                  y: y + TYPOGRAPHY.BODY_FONT_SIZE * BULLET.VERTICAL_BASELINE_RATIO,
                  size: BULLET.GLYPH_RADIUS,
                  color: WARNING_BORDER,
                });
              }
              page.drawText(bulletLines[i], {
                x: warningTextX + WARNING.BULLET_TEXT_X_OFFSET,
                y,
                size: TYPOGRAPHY.BODY_FONT_SIZE,
                font: helvetica,
                color: TEXT_DARK,
              });
              y -= TYPOGRAPHY.LINE_HEIGHT;
            }
          } else {
            const lines = wrapText(wBlock.cleanText, TYPOGRAPHY.BODY_FONT_SIZE, warningTextWidth);
            for (const line of lines) {
              page.drawText(line, {
                x: warningTextX,
                y,
                size: TYPOGRAPHY.BODY_FONT_SIZE,
                font: helvetica,
                color: TEXT_DARK,
              });
              y -= TYPOGRAPHY.LINE_HEIGHT;
            }
          }
        }

        y -= WARNING.BOTTOM_GAP;
        blockIdx = endIdx;
      } else {
        // Regular text
        const lines = wrapText(block.cleanText, TYPOGRAPHY.BODY_FONT_SIZE, PAGE.MAX_TEXT_WIDTH);
        for (const line of lines) {
          if (y < PAGE.MARGIN + PAGE_BREAK.FOOTER_RESERVE) {
            page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
            allPages.push({ page, icdLabel });
            y = PAGE.HEIGHT - PAGE.MARGIN;
          }
          page.drawText(line, {
            x: PAGE.MARGIN,
            y,
            size: TYPOGRAPHY.BODY_FONT_SIZE,
            font: helvetica,
            color: TEXT_DARK,
          });
          y -= TYPOGRAPHY.LINE_HEIGHT;
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
