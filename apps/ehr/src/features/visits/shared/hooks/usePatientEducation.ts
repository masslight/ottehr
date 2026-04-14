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

async function generateCombinedPdf(
  sections: { content: string; patientTitle: string; icdCode: string; icdDescription: string }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const bodyFontSize = 11;
  const headerFontSize = 14;
  const titleFontSize = 18;
  const lineHeight = bodyFontSize * 1.4;

  for (const section of sections) {
    // Each diagnosis starts on a new page
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Patient-friendly title
    const titleLines = wrapText(section.patientTitle, titleFontSize, maxWidth);
    for (const line of titleLines) {
      page.drawText(line, { x: margin, y, size: titleFontSize, font: timesRomanBold, color: rgb(0.1, 0.1, 0.4) });
      y -= titleFontSize * 1.5;
    }

    // ICD code and clinical description subtitle
    page.drawText(`${section.icdCode} — ${section.icdDescription}`, {
      x: margin,
      y,
      size: 10,
      font: timesRoman,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 25;

    // Body content
    const paragraphs = section.content.split('\n');
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        y -= lineHeight * 0.5;
        continue;
      }

      const isHeader =
        /^#{1,3}\s/.test(trimmed) || /^[A-Z][A-Z\s/()-]+:?$/.test(trimmed) || /^\d+\.\s+[A-Z]/.test(trimmed);
      const cleanText = trimmed.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '');

      const font = isHeader ? timesRomanBold : timesRoman;
      const fontSize = isHeader ? headerFontSize : bodyFontSize;
      const currentLineHeight = isHeader ? fontSize * 1.8 : lineHeight;

      if (isHeader) y -= 5;

      const lines = wrapText(cleanText, fontSize, maxWidth);
      for (const line of lines) {
        if (y < margin + 30) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= currentLineHeight;
      }
    }
  }

  // Footer on last page
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText('Source: MedlinePlus (U.S. National Library of Medicine)', {
    x: margin,
    y: margin,
    size: 9,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.4),
  });
  lastPage.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
    x: margin,
    y: margin - 14,
    size: 9,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.4),
  });

  return pdfDoc.save();
}
