import { Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PageSizes, PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';

const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];
const MARGIN = 48;
const LINE_HEIGHT = 14;
const BOTTOM_MARGIN = 60;

// todo sarah can we re-use existing pdf helpers in stead?
export async function renderQrPdf(
  qr: QuestionnaireResponse,
  questionnaire: Questionnaire | undefined,
  patient: Patient,
  NOW: DateTime
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = (): void => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensureSpace = (needed: number): void => {
    if (y - needed < BOTTOM_MARGIN) newPage();
  };
  const drawLine = (text: string, opts: { font?: PDFFont; size?: number; indent?: number } = {}): void => {
    const font = opts.font || regular;
    const size = opts.size || 10;
    const indent = opts.indent || 0;
    // Helvetica can only encode WinAnsi; swap out Unicode characters we emit
    // from calculated expressions (≥, em-dash) for Latin-1 equivalents.
    const safe = sanitizeForWinAnsi(text);
    const lines = wrapText(safe, font, size, PAGE_WIDTH - MARGIN * 2 - indent);
    for (const line of lines) {
      ensureSpace(size + 2);
      page.drawText(line, { x: MARGIN + indent, y, size, font });
      y -= LINE_HEIGHT;
    }
  };

  const title = questionnaire?.title || questionnaire?.name || 'Form';
  drawLine(title, { font: bold, size: 16 });
  y -= 4;
  const name = (patient.name?.[0]?.given?.join(' ') || '') + ' ' + (patient.name?.[0]?.family || '');
  drawLine(`Patient: ${name.trim()}${patient.birthDate ? ` (DOB ${patient.birthDate})` : ''}`, {
    font: regular,
    size: 10,
  });
  drawLine(`Completed: ${NOW.toFormat('yyyy-MM-dd HH:mm')}`, { font: regular, size: 10 });
  y -= 10;

  // Build a flat list of Q items (for hidden-check) and a map by linkId
  const allQItems: any[] = [];
  const walkQ = (items: any[]): void => {
    for (const it of items || []) {
      allQItems.push(it);
      if (it.item) walkQ(it.item);
    }
  };
  walkQ(questionnaire?.item || []);
  const qItemByLinkId = new Map(allQItems.map((it) => [it.linkId, it]));
  const isHidden = (item: any): boolean =>
    !!item?.extension?.some(
      (e: any) => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden' && e.valueBoolean === true
    );

  // Render each page group
  const pageGroups = (qr.item || []).filter((p) => p.linkId !== 'results');
  for (const p of pageGroups) {
    const qp = qItemByLinkId.get(p.linkId);
    const pageTitle = qp?.text || p.linkId;
    ensureSpace(20);
    drawLine(pageTitle, { font: bold, size: 12 });
    y -= 2;
    for (const child of p.item || []) {
      const qItem = qItemByLinkId.get(child.linkId);
      if (isHidden(qItem)) continue;
      const label = qItem?.text || child.linkId;
      const value = formatAnswer(child);
      drawLine(label, { font: regular, size: 10, indent: 10 });
      drawLine(`  ${value}`, { font: bold, size: 10, indent: 10 });
      y -= 4;
    }
    y -= 6;
  }

  // Render "Screening Results" if present
  const results = (qr.item || []).find((p) => p.linkId === 'results');
  if (results?.item?.length) {
    ensureSpace(20);
    drawLine('Screening Results', { font: bold, size: 12 });
    y -= 2;
    // Pair each computed item with its rationale (same convention as the viewer)
    const resultMap = new Map((results.item || []).map((i) => [i.linkId, i]));
    const rendered = new Set<string>();
    for (const item of results.item) {
      if (rendered.has(item.linkId)) continue;
      if (item.linkId.endsWith('-rationale')) continue;
      rendered.add(item.linkId);
      const q = qItemByLinkId.get(item.linkId);
      const label = q?.text || item.linkId;
      const value = formatAnswer(item);
      drawLine(`${label}: ${value}`, { font: regular, size: 10, indent: 10 });
      const rationale = resultMap.get(`${item.linkId}-rationale`);
      if (rationale) {
        rendered.add(rationale.linkId);
        const r = rationale.answer?.[0]?.valueString;
        if (r) drawLine(r, { font: regular, size: 9, indent: 20 });
      }
    }
  }

  return pdf.save();
}

// todo sarah what is this
function formatAnswer(item: any): string {
  const a = item.answer?.[0];
  if (!a) return '';
  if (a.valueCoding?.display) return a.valueCoding.display;
  if (a.valueString !== undefined) return a.valueString;
  if (a.valueBoolean !== undefined) return a.valueBoolean ? 'Positive' : 'Negative';
  if (a.valueInteger !== undefined) return String(a.valueInteger);
  if (a.valueDecimal !== undefined) return String(a.valueDecimal);
  if (a.valueDate) return a.valueDate;
  if (a.valueDateTime) return a.valueDateTime;
  return '';
}

// todo sarah again can we reuse
function sanitizeForWinAnsi(text: string): string {
  return String(text || '')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2260/g, '!=')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '?');
}

// todo sarah again can we reuse
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text || '').split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
