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

async function generatePdf(content: string, icdCode: string, icdDescription: string): Promise<Uint8Array> {
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

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  const title = `Patient Education: ${icdDescription}`;
  const titleLines = wrapText(title, titleFontSize, maxWidth);
  for (const line of titleLines) {
    page.drawText(line, { x: margin, y, size: titleFontSize, font: timesRomanBold, color: rgb(0.1, 0.1, 0.4) });
    y -= titleFontSize * 1.5;
  }

  // ICD code subtitle
  page.drawText(`ICD-10: ${icdCode}`, { x: margin, y, size: 10, font: timesRoman, color: rgb(0.4, 0.4, 0.4) });
  y -= 25;

  // Body content
  const paragraphs = content.split('\n');
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

  // Footer
  if (y < margin + 50) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }
  y -= 20;
  page.drawText('Source: MedlinePlus (U.S. National Library of Medicine)', {
    x: margin,
    y,
    size: 9,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 14;
  page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
    x: margin,
    y,
    size: 9,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.4),
  });

  return pdfDoc.save();
}

export interface UsePatientEducationResult {
  generate: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  primaryDiagnosis: { code: string; display: string } | null;
}

export function usePatientEducation(): UsePatientEducationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { chartData } = useChartData();
  const apiClient = useOystehrAPIClient();

  const diagnoses = chartData?.diagnosis ?? [];
  const primary = diagnoses.find((d) => d.isPrimary) ?? null;
  const primaryDiagnosis = primary ? { code: primary.code, display: primary.display } : null;

  const generate = async (): Promise<void> => {
    if (!primaryDiagnosis) {
      setError('No primary diagnosis found. Please add a diagnosis in the Assessment tab first.');
      return;
    }
    if (!apiClient) {
      setError('API client not available.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call zambda which fetches MedlinePlus + calls Gemini server-side
      const result = await apiClient.generatePatientEducation({
        icdCode: primaryDiagnosis.code,
        icdDescription: primaryDiagnosis.display,
      });

      if (!result.content) {
        setError(result.error ?? 'No content generated.');
        setIsLoading(false);
        return;
      }

      // Generate PDF client-side from the AI content
      const pdfBytes = await generatePdf(result.content, primaryDiagnosis.code, primaryDiagnosis.display);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      console.error('Patient education generation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, error, primaryDiagnosis };
}
