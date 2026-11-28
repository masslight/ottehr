import { Address } from 'fhir/r4b';
import { PDFImage } from 'pdf-lib';
import { InvoiceIssuer } from 'utils/lib/fhir/billing-invoice';
import { palette } from 'utils/lib/theme/billing-palette';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { loadPdfAssets, StyleFactory } from './pdf-common';
import { PDF_CLIENT_STYLES } from './pdf-consts';
import { createPdfClient, hexColor, SEPARATED_LINE_STYLE, splitLongStringToPageSize } from './pdf-utils';
import { AssetPaths, PdfClient, PdfStyles, TextStyle } from './types';

const LOGO_MAX_WIDTH = 140;
// The logo lives in the page's 40pt top margin band, so it must fit there with the gap.
const LOGO_MAX_HEIGHT = 30;
const LINE_GAP = 2;
const WRAP_SAFETY = 8;
const CELL_PADDING_X = 6;
const CELL_PADDING_Y = 5;
const SECTION_GAP = 18;
const TOTALS_WIDTH_RATIO = 0.4;
const SEPARATOR_DROP = 20;
const VISIT_GAP = 16;
const VISIT_RULE_DROP = 16;
const LOGO_GAP = 4;
// The visit column takes its ratio of the table width; the service ratios split the rest.
const VISIT_COLUMN_RATIO = 0.36;
// Price, Qty and Total have fixed widths so amounts never wrap; Service takes the remaining width.
const NUMERIC_COLUMN_WIDTHS = [76, 44, 80];
// Column indexes across the whole row: Visit is 0, then Service, Price, Qty, Total.
const RIGHT_ALIGNED_COLUMNS = [2, 3, 4];

export interface NioInvoicePdfServiceLine {
  description: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
}

export interface NioInvoicePdfLine {
  claimId: string;
  patientName: string;
  // The friendly patient ID, or the patient's FHIR id when none is set.
  patientFriendlyId: string;
  // YYYY-MM-DD
  serviceDate: string;
  facilityName: string;
  serviceLines: NioInvoicePdfServiceLine[];
  // The claim amount: the sum of its service lines.
  billedCents: number;
  // The balance the invoice asks for, which is the billed amount less payments and adjustments.
  amountCents: number;
}

export interface NioInvoicePdfData {
  invoiceNumber: string;
  // YYYY-MM-DD
  issueDate: string;
  // YYYY-MM-DD
  dueDate: string;
  issuer: Pick<InvoiceIssuer, 'name' | 'address'>;
  billTo: {
    name: string;
    address?: Address;
  };
  lines: NioInvoicePdfLine[];
}

const nioInvoiceAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Medium.ttf',
    heavy: './assets/Rubik-Bold.otf',
  },
};

const TEXT_COLOR = hexColor(palette.text.primary);
const MUTED_COLOR = hexColor(palette.text.secondary);
const LIGHT_MUTED_COLOR = hexColor('#9AA1B0');
const ACCENT_COLOR = hexColor(palette.primary.main);
const RULE_STYLE = { ...SEPARATED_LINE_STYLE, thickness: 0.5 };

// Style keys are looked up by string and not type-checked: define every key the renderer uses.
const createNioInvoiceStyles: StyleFactory = (assets) => ({
  textStyles: {
    issuerName: {
      fontSize: 14,
      font: assets.fonts.bold,
      color: TEXT_COLOR,
      spacing: 4,
    },
    meta: {
      fontSize: 10,
      font: assets.fonts.regular,
      color: MUTED_COLOR,
      spacing: 4,
    },
    label: {
      fontSize: 9,
      font: assets.fonts.regular,
      color: MUTED_COLOR,
      spacing: 4,
    },
    billToName: {
      fontSize: 13,
      font: assets.fonts.bold,
      color: TEXT_COLOR,
      spacing: 4,
    },
    tableHeader: {
      fontSize: 10,
      font: assets.fonts.bold,
      color: ACCENT_COLOR,
      spacing: 2,
    },
    tableCell: {
      fontSize: 10,
      font: assets.fonts.regular,
      color: TEXT_COLOR,
      spacing: 2,
    },
    visitName: {
      fontSize: 11,
      font: assets.fonts.bold,
      color: TEXT_COLOR,
      spacing: 2,
    },
    visitPatientId: {
      fontSize: 8,
      font: assets.fonts.regular,
      color: LIGHT_MUTED_COLOR,
      spacing: 2,
    },
    tableTotal: {
      fontSize: 10,
      font: assets.fonts.heavy,
      color: TEXT_COLOR,
      spacing: 2,
    },
    subtotal: {
      fontSize: 10,
      font: assets.fonts.regular,
      color: MUTED_COLOR,
      spacing: 4,
    },
    total: {
      fontSize: 15,
      font: assets.fonts.heavy,
      color: TEXT_COLOR,
      spacing: 4,
    },
    footer: {
      fontSize: 8,
      font: assets.fonts.regular,
      color: MUTED_COLOR,
      spacing: 2,
      newLineAfter: true,
    },
  },
  lineStyles: {
    separator: SEPARATED_LINE_STYLE,
    rule: RULE_STYLE,
  },
});

export const formatInvoiceAddressLines = (address: Address | undefined): string[] => {
  if (!address) return [];
  const street = (address.line ?? []).filter(Boolean).join(', ');
  const stateZip = [address.state, address.postalCode].filter(Boolean).join(' ');
  const locality = [address.city, stateZip].filter(Boolean).join(', ');
  return [street, locality].filter(Boolean);
};

const lineHeightOf = (style: TextStyle): number => style.font.heightAtSize(style.fontSize) + style.spacing;

const drawLeft = (pdfClient: PdfClient, text: string, style: TextStyle, left: number, right: number): void => {
  pdfClient.drawStartXPosSpecifiedText(text, style, left, {
    leftBound: left,
    rightBound: right,
  });
};

const drawRight = (pdfClient: PdfClient, text: string, style: TextStyle, right: number): void => {
  const left = right - pdfClient.getTextDimensions(text, style).width;
  drawLeft(pdfClient, text, style, left, right + WRAP_SAFETY);
};

// Draws each line top-down from the current Y and leaves Y on the last line drawn.
const drawLines = (
  pdfClient: PdfClient,
  lines: { text: string; style: TextStyle }[],
  draw: (text: string, style: TextStyle) => void
): void => {
  lines.forEach(({ text, style }, index) => {
    if (index > 0) pdfClient.setY(pdfClient.getY() - lineHeightOf(style));
    draw(text, style);
  });
};

// drawImage anchors the image's bottom edge at the cursor, so the cursor drops by its height first.
// drawSeparatedLine draws above the cursor, expecting it on the next line rather than the last one
// drawn, so the cursor drops first to keep the line clear of the text above it.
const drawSeparator = (pdfClient: PdfClient, styles: PdfStyles): void => {
  pdfClient.setY(pdfClient.getY() - SEPARATOR_DROP);
  pdfClient.drawSeparatedLine(styles.lineStyles.separator);
};

// The logo sits top right in the page's top margin band, above the content area, so the header
// columns start at the top content line instead of below the logo.
const drawLogo = (pdfClient: PdfClient, logo: PDFImage | undefined, right: number, top: number): void => {
  if (!logo) return;
  const scale = Math.min(LOGO_MAX_WIDTH / logo.width, LOGO_MAX_HEIGHT / logo.height, 1);
  const width = logo.width * scale;
  const height = logo.height * scale;
  pdfClient.setX(right - width);
  pdfClient.setY(top + LOGO_GAP);
  pdfClient.drawImage(logo, { width, height });
  pdfClient.setY(top);
};

// Branding sits top right with the issue date under it; Bill To sits top left, with the invoice number
// and due date below a blank line.
const drawHeader = (pdfClient: PdfClient, styles: PdfStyles, data: NioInvoicePdfData, logo?: PDFImage): void => {
  const { textStyles } = styles;
  const left = pdfClient.getLeftBound();
  const right = pdfClient.getRightBound();
  const middle = left + (right - left) / 2;
  const top = pdfClient.getY();

  drawLogo(pdfClient, logo, right, top);
  pdfClient.setY(top - lineHeightOf(textStyles.issuerName));
  drawLines(
    pdfClient,
    [
      { text: data.issuer.name, style: textStyles.issuerName },
      ...formatInvoiceAddressLines(data.issuer.address).map((text) => ({ text, style: textStyles.meta })),
    ],
    (text, style) => drawRight(pdfClient, text, style, right)
  );
  // A blank line between the address and the issue date.
  pdfClient.setY(pdfClient.getY() - 2 * lineHeightOf(textStyles.meta));
  drawRight(pdfClient, `Issued on ${formatDateForDisplay(data.issueDate)}`, textStyles.meta, right);
  const brandingBottom = pdfClient.getY();

  pdfClient.setY(top - lineHeightOf(textStyles.label));
  drawLines(
    pdfClient,
    [
      { text: 'BILL TO', style: textStyles.label },
      { text: data.billTo.name, style: textStyles.billToName },
      ...formatInvoiceAddressLines(data.billTo.address).map((text) => ({ text, style: textStyles.meta })),
    ],
    (text, style) => drawLeft(pdfClient, text, style, left, middle)
  );
  // A blank line between the Bill To address and the invoice details.
  pdfClient.setY(pdfClient.getY() - 2 * lineHeightOf(textStyles.meta));
  drawLines(
    pdfClient,
    [
      { text: `Invoice #: ${data.invoiceNumber}`, style: textStyles.meta },
      { text: `Due ${formatDateForDisplay(data.dueDate)}`, style: textStyles.meta },
    ],
    (text, style) => drawLeft(pdfClient, text, style, left, middle)
  );

  pdfClient.setY(Math.min(brandingBottom, pdfClient.getY()));
  drawSeparator(pdfClient, styles);
};

type StyledLine = { text: string; style: TextStyle };

interface TableColumn {
  left: number;
  width: number;
  rightAligned: boolean;
}

// Each visit is a row group: the visit details fill the Visit column beside its service rows, and the
// visit total closes the group. A thin rule separates one visit from the next.
const drawClaimsTable = (pdfClient: PdfClient, styles: PdfStyles, lines: NioInvoicePdfLine[]): void => {
  const headerStyle = styles.textStyles.tableHeader;
  const cellStyle = styles.textStyles.tableCell;
  const visitNameStyle = styles.textStyles.visitName;
  const visitPatientIdStyle = styles.textStyles.visitPatientId;
  const totalStyle = styles.textStyles.tableTotal;
  const left = pdfClient.getLeftBound();
  const tableWidth = pdfClient.getRightBound() - left;
  const visitWidth = tableWidth * VISIT_COLUMN_RATIO;
  const numericWidth = NUMERIC_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
  const columnWidths = [visitWidth, tableWidth - visitWidth - numericWidth, ...NUMERIC_COLUMN_WIDTHS];
  const columns: TableColumn[] = [];
  columnWidths.reduce((cellLeft, width, index) => {
    columns.push({ left: cellLeft, width, rightAligned: RIGHT_ALIGNED_COLUMNS.includes(index) });
    return cellLeft + width;
  }, left);
  const bottomMargin = PDF_CLIENT_STYLES.initialPage.pageMargins.bottom ?? 0;
  const lineHeightFor = (style: TextStyle): number => style.font.heightAtSize(style.fontSize) + LINE_GAP;
  const needsNewPage = (height: number, breakLineHeight: number): boolean =>
    pdfClient.getY() - height - breakLineHeight < bottomMargin;

  // A cell is a list of lines, each with its own style, so one cell can mix font sizes.
  const drawRow = (cells: StyledLine[][], isHeader = false): void => {
    const lineSets = cells.map((cell, column) =>
      cell.flatMap(({ text, style }) =>
        splitLongStringToPageSize(
          text,
          style.font,
          style.fontSize,
          columns[column].width - CELL_PADDING_X * 2 - WRAP_SAFETY
        ).map((part) => ({ text: part, style }))
      )
    );
    const cellHeights = lineSets.map((set) => set.reduce((sum, { style }) => sum + lineHeightFor(style), 0));
    const height = Math.max(...cellHeights) + CELL_PADDING_Y * 2;
    const breakLineHeight = Math.max(...lineSets.flat().map(({ style }) => lineHeightFor(style)));

    // drawTextSequential breaks the page itself once a baseline sits within one line of the margin
    // which would split this row's cells across pages.
    if (needsNewPage(height, breakLineHeight)) {
      pdfClient.addNewPage(PDF_CLIENT_STYLES.initialPage);
      if (!isHeader) drawHeaderRow();
    }

    const top = pdfClient.getY();
    lineSets.forEach((set, column) => {
      const { left: columnLeft, width, rightAligned } = columns[column];
      const cellLeft = columnLeft + CELL_PADDING_X;
      const cellRight = columnLeft + width - CELL_PADDING_X;
      let cursor = top - CELL_PADDING_Y;
      set.forEach(({ text, style }) => {
        cursor -= lineHeightFor(style);
        pdfClient.setY(cursor);
        if (rightAligned) drawRight(pdfClient, text, style, cellRight);
        else drawLeft(pdfClient, text, style, cellLeft, cellRight);
      });
    });
    pdfClient.setY(top - height);
  };

  const drawHeaderRow = (): void =>
    drawRow(
      ['Visit', 'Service', 'Price', 'Qty', 'Total'].map((text) => [{ text, style: headerStyle }]),
      true
    );

  const visitDetails = (line: NioInvoicePdfLine): StyledLine[] => {
    const details: StyledLine[] = [
      { text: line.patientName, style: visitNameStyle },
      { text: formatDateForDisplay(line.serviceDate), style: cellStyle },
      { text: line.facilityName, style: cellStyle },
    ];
    if (line.patientFriendlyId) {
      details.push({ text: `Patient ID: ${line.patientFriendlyId}`, style: visitPatientIdStyle });
    }
    return details;
  };

  // Service rows leave the Visit column empty; the visit details render beside them as their own flow.
  const serviceRows = (line: NioInvoicePdfLine): StyledLine[][][] => {
    const serviceLines =
      line.serviceLines.length > 0
        ? line.serviceLines
        : [{ description: '', unitPriceCents: 0, quantity: 0, totalCents: 0 }];
    return serviceLines.map((serviceLine) => [
      [],
      [{ text: serviceLine.description, style: cellStyle }],
      [{ text: formatCurrencyFromCents(serviceLine.unitPriceCents), style: cellStyle }],
      [{ text: serviceLine.quantity ? String(serviceLine.quantity) : '', style: cellStyle }],
      [{ text: formatCurrencyFromCents(serviceLine.totalCents), style: cellStyle }],
    ]);
  };

  const visitTotalRow = (line: NioInvoicePdfLine): StyledLine[][] => [
    [],
    [{ text: 'Visit total:', style: totalStyle }],
    [],
    [],
    [{ text: formatCurrencyFromCents(line.billedCents), style: totalStyle }],
  ];

  // The details block and the service rows are independent vertical flows that share a top edge, so a
  // tall details block doesn't stretch the first service row's height.
  const drawVisit = (line: NioInvoicePdfLine, separate: boolean): void => {
    const visitColumn = columns[0];
    const details = visitDetails(line).flatMap(({ text, style }) =>
      splitLongStringToPageSize(
        text,
        style.font,
        style.fontSize,
        visitColumn.width - CELL_PADDING_X * 2 - WRAP_SAFETY
      ).map((part) => ({ text: part, style }))
    );
    const detailsHeight = details.reduce((sum, { style }) => sum + lineHeightFor(style), 0) + CELL_PADDING_Y * 2;
    const ruleHeight = separate ? VISIT_GAP * 2 + VISIT_RULE_DROP : 0;

    // Keep the details block and the first service row starting together on one page. A fresh page
    // skips the rule: nothing above it to separate from.
    if (needsNewPage(detailsHeight + ruleHeight, Math.max(...details.map(({ style }) => lineHeightFor(style))))) {
      pdfClient.addNewPage(PDF_CLIENT_STYLES.initialPage);
      drawHeaderRow();
    } else if (separate) {
      pdfClient.setY(pdfClient.getY() - VISIT_GAP - VISIT_RULE_DROP);
      pdfClient.drawSeparatedLine(styles.lineStyles.rule);
      pdfClient.setY(pdfClient.getY() - VISIT_GAP);
    }

    const groupTop = pdfClient.getY();
    let cursor = groupTop - CELL_PADDING_Y;
    details.forEach(({ text, style }) => {
      cursor -= lineHeightFor(style);
      pdfClient.setY(cursor);
      drawLeft(
        pdfClient,
        text,
        style,
        visitColumn.left + CELL_PADDING_X,
        visitColumn.left + visitColumn.width - CELL_PADDING_X
      );
    });
    const detailsBottom = groupTop - detailsHeight;

    pdfClient.setY(groupTop);
    let brokePage = false;
    serviceRows(line).forEach((row) => {
      const before = pdfClient.getY();
      drawRow(row);
      // After a page break Y jumps back up to the top of the new page.
      if (pdfClient.getY() > before) brokePage = true;
    });
    // The visit total clears both flows, unless the service rows moved to a fresh page and left the
    // details block behind on the previous one.
    if (!brokePage) pdfClient.setY(Math.min(detailsBottom, pdfClient.getY()));
    drawRow(visitTotalRow(line));
  };

  drawHeaderRow();
  lines.forEach((line, index) => drawVisit(line, index > 0));
};

const drawTotals = (pdfClient: PdfClient, styles: PdfStyles, lines: NioInvoicePdfLine[]): void => {
  const { textStyles } = styles;
  const right = pdfClient.getRightBound();
  const left = right - (right - pdfClient.getLeftBound()) * TOTALS_WIDTH_RATIO;
  const billedCents = lines.reduce((sum, line) => sum + line.billedCents, 0);
  const dueCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const adjustmentsCents = billedCents - dueCents;
  const subtotalRows = adjustmentsCents !== 0 ? 2 : 1;
  const blockHeight =
    lineHeightOf(textStyles.subtotal) * subtotalRows +
    lineHeightOf(textStyles.total) * 2 +
    SECTION_GAP * 2 +
    SEPARATOR_DROP;

  if (pdfClient.getY() - blockHeight < (PDF_CLIENT_STYLES.initialPage.pageMargins.bottom ?? 0)) {
    pdfClient.addNewPage(PDF_CLIENT_STYLES.initialPage);
  }

  pdfClient.setY(pdfClient.getY() - SECTION_GAP - lineHeightOf(textStyles.subtotal));
  drawLeft(pdfClient, `Claims (${lines.length})`, textStyles.subtotal, left, right);
  drawRight(pdfClient, formatCurrencyFromCents(billedCents), textStyles.subtotal, right);
  if (adjustmentsCents !== 0) {
    pdfClient.setY(pdfClient.getY() - lineHeightOf(textStyles.subtotal));
    drawLeft(pdfClient, 'Less payments and adjustments', textStyles.subtotal, left, right);
    drawRight(pdfClient, formatCurrencyFromCents(-adjustmentsCents), textStyles.subtotal, right);
  }
  const pageLeft = pdfClient.getLeftBound();
  pdfClient.setLeftBound(left);
  drawSeparator(pdfClient, styles);
  pdfClient.setLeftBound(pageLeft);
  pdfClient.setY(pdfClient.getY() - lineHeightOf(textStyles.total) + SEPARATOR_DROP);
  drawLeft(pdfClient, 'Total due', textStyles.total, left, right);
  drawRight(pdfClient, formatCurrencyFromCents(dueCents), textStyles.total, right);
};

export async function renderNioInvoicePdf(data: NioInvoicePdfData): Promise<Uint8Array> {
  if (data.lines.length === 0) throw new Error('An invoice PDF needs at least one claim line');

  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
  const assets = await loadPdfAssets(pdfClient, nioInvoiceAssetPaths);
  const styles = createNioInvoiceStyles(assets);

  drawHeader(pdfClient, styles, data, assets.logo);
  pdfClient.setY(pdfClient.getY() - SECTION_GAP);
  drawClaimsTable(pdfClient, styles, data.lines);
  drawTotals(pdfClient, styles, data.lines);

  pdfClient.numberPages(styles.textStyles.footer);
  return await pdfClient.save();
}
