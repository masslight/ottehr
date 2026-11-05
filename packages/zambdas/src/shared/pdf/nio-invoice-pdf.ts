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
const LOGO_MAX_HEIGHT = 36;
const LINE_GAP = 2;
const WRAP_SAFETY = 8;
const CELL_PADDING_X = 6;
const CELL_PADDING_Y = 5;
const SECTION_GAP = 18;
const TOTALS_WIDTH_RATIO = 0.4;
const SEPARATOR_DROP = 20;
const COLUMN_RATIOS = [0.18, 0.26, 0.22, 0.18, 0.16];
const RIGHT_ALIGNED_COLUMN = COLUMN_RATIOS.length - 1;
const HEADER_CELLS = ['Service Date', 'Patient', 'Service', 'Claim ID', 'Amount Due'];

export interface NioInvoicePdfLine {
  claimId: string;
  patientName: string;
  // YYYY-MM-DD
  serviceDate: string;
  service: string;
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
const ACCENT_COLOR = hexColor(palette.primary.main);

// Style keys are looked up by string and not type-checked: define every key the renderer uses.
const createNioInvoiceStyles: StyleFactory = (assets) => ({
  textStyles: {
    title: {
      fontSize: 24,
      font: assets.fonts.heavy,
      color: ACCENT_COLOR,
      spacing: 6,
    },
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

const drawLogo = (pdfClient: PdfClient, logo: PDFImage | undefined): number => {
  if (!logo) return 0;
  const scale = Math.min(LOGO_MAX_WIDTH / logo.width, LOGO_MAX_HEIGHT / logo.height, 1);
  const height = logo.height * scale;
  pdfClient.setX(pdfClient.getLeftBound());
  pdfClient.setY(pdfClient.getY() - height);
  pdfClient.drawImage(logo, {
    width: logo.width * scale,
    height,
  });
  return height;
};

const drawHeader = (pdfClient: PdfClient, styles: PdfStyles, data: NioInvoicePdfData, logo?: PDFImage): void => {
  const { textStyles } = styles;
  const left = pdfClient.getLeftBound();
  const right = pdfClient.getRightBound();
  const middle = left + (right - left) / 2;
  const top = pdfClient.getY();

  const logoHeight = drawLogo(pdfClient, logo);
  pdfClient.setY(top - logoHeight - (logoHeight ? SECTION_GAP : 0) - lineHeightOf(textStyles.issuerName));
  drawLines(
    pdfClient,
    [
      {
        text: data.issuer.name,
        style: textStyles.issuerName,
      },
      ...formatInvoiceAddressLines(data.issuer.address).map((text) => ({
        text,
        style: textStyles.meta,
      })),
    ],
    (text, style) => drawLeft(pdfClient, text, style, left, middle)
  );
  const issuerBottom = pdfClient.getY();

  pdfClient.setY(top - lineHeightOf(textStyles.title));
  drawLines(
    pdfClient,
    [
      {
        text: 'INVOICE',
        style: textStyles.title,
      },
      {
        text: `Invoice #: ${data.invoiceNumber}`,
        style: textStyles.meta,
      },
      {
        text: `Issue date: ${formatDateForDisplay(data.issueDate)}`,
        style: textStyles.meta,
      },
      {
        text: `Due date: ${formatDateForDisplay(data.dueDate)}`,
        style: textStyles.meta,
      },
    ],
    (text, style) => drawRight(pdfClient, text, style, right)
  );

  pdfClient.setY(Math.min(issuerBottom, pdfClient.getY()));
  drawSeparator(pdfClient, styles);
};

const drawBillTo = (pdfClient: PdfClient, styles: PdfStyles, data: NioInvoicePdfData): void => {
  const { textStyles } = styles;
  const left = pdfClient.getLeftBound();
  const right = pdfClient.getRightBound();
  pdfClient.setY(pdfClient.getY() - SECTION_GAP);
  drawLines(
    pdfClient,
    [
      {
        text: 'BILL TO',
        style: textStyles.label,
      },
      {
        text: data.billTo.name,
        style: textStyles.billToName,
      },
      ...formatInvoiceAddressLines(data.billTo.address).map((text) => ({
        text,
        style: textStyles.meta,
      })),
    ],
    (text, style) => drawLeft(pdfClient, text, style, left, right)
  );
};

const drawClaimsTable = (pdfClient: PdfClient, styles: PdfStyles, lines: NioInvoicePdfLine[]): void => {
  const headerStyle = styles.textStyles.tableHeader;
  const cellStyle = styles.textStyles.tableCell;
  const left = pdfClient.getLeftBound();
  const tableWidth = pdfClient.getRightBound() - left;
  const widths = COLUMN_RATIOS.map((ratio) => tableWidth * ratio);
  const offsets = widths.map((_, index) => left + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
  const bottomMargin = PDF_CLIENT_STYLES.initialPage.pageMargins.bottom ?? 0;

  const drawRow = (cells: string[], style: TextStyle, isHeader = false): void => {
    const lineHeight = style.font.heightAtSize(style.fontSize) + LINE_GAP;
    const lineSets = cells.map((text, column) =>
      splitLongStringToPageSize(text, style.font, style.fontSize, widths[column] - CELL_PADDING_X * 2 - WRAP_SAFETY)
    );
    const height = Math.max(...lineSets.map((set) => set.length)) * lineHeight + CELL_PADDING_Y * 2;

    // drawTextSequential breaks the page itself once a baseline sits within one line of the margin
    // which would split this row's cells across pages.
    if (pdfClient.getY() - height - lineHeight < bottomMargin) {
      pdfClient.addNewPage(PDF_CLIENT_STYLES.initialPage);
      if (!isHeader) drawHeaderRow();
    }

    const top = pdfClient.getY();
    lineSets.forEach((set, column) => {
      const cellLeft = offsets[column] + CELL_PADDING_X;
      const cellRight = offsets[column] + widths[column] - CELL_PADDING_X;
      set.forEach((text, index) => {
        pdfClient.setY(top - CELL_PADDING_Y - (index + 1) * lineHeight);
        if (column === RIGHT_ALIGNED_COLUMN) drawRight(pdfClient, text, style, cellRight);
        else drawLeft(pdfClient, text, style, cellLeft, cellRight);
      });
    });
    pdfClient.setY(top - height);
  };

  const drawHeaderRow = (): void => drawRow(HEADER_CELLS, headerStyle, true);

  drawHeaderRow();
  lines.forEach((line) =>
    drawRow(
      [
        formatDateForDisplay(line.serviceDate),
        line.patientName,
        line.service,
        line.claimId,
        formatCurrencyFromCents(line.amountCents),
      ],
      cellStyle
    )
  );
};

const drawTotals = (pdfClient: PdfClient, styles: PdfStyles, lines: NioInvoicePdfLine[]): void => {
  const { textStyles } = styles;
  const right = pdfClient.getRightBound();
  const left = right - (right - pdfClient.getLeftBound()) * TOTALS_WIDTH_RATIO;
  const total = formatCurrencyFromCents(lines.reduce((sum, line) => sum + line.amountCents, 0));
  const blockHeight =
    lineHeightOf(textStyles.subtotal) + lineHeightOf(textStyles.total) * 2 + SECTION_GAP * 2 + SEPARATOR_DROP;

  if (pdfClient.getY() - blockHeight < (PDF_CLIENT_STYLES.initialPage.pageMargins.bottom ?? 0)) {
    pdfClient.addNewPage(PDF_CLIENT_STYLES.initialPage);
  }

  pdfClient.setY(pdfClient.getY() - SECTION_GAP - lineHeightOf(textStyles.subtotal));
  drawLeft(pdfClient, `Claims (${lines.length})`, textStyles.subtotal, left, right);
  drawRight(pdfClient, total, textStyles.subtotal, right);
  const pageLeft = pdfClient.getLeftBound();
  pdfClient.setLeftBound(left);
  drawSeparator(pdfClient, styles);
  pdfClient.setLeftBound(pageLeft);
  pdfClient.setY(pdfClient.getY() - lineHeightOf(textStyles.total) + SEPARATOR_DROP);
  drawLeft(pdfClient, 'Total due', textStyles.total, left, right);
  drawRight(pdfClient, total, textStyles.total, right);
};

export async function renderNioInvoicePdf(data: NioInvoicePdfData): Promise<Uint8Array> {
  if (data.lines.length === 0) throw new Error('An invoice PDF needs at least one claim line');

  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
  const assets = await loadPdfAssets(pdfClient, nioInvoiceAssetPaths);
  const styles = createNioInvoiceStyles(assets);

  drawHeader(pdfClient, styles, data, assets.logo);
  drawBillTo(pdfClient, styles, data);
  pdfClient.setY(pdfClient.getY() - SECTION_GAP);
  drawClaimsTable(pdfClient, styles, data.lines);
  drawTotals(pdfClient, styles, data.lines);

  pdfClient.numberPages(styles.textStyles.footer);
  return await pdfClient.save();
}
