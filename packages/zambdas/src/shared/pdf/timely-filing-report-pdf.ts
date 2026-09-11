import { Claim, Coverage, Organization, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Color } from 'pdf-lib';
import { getNPI, getTaxID } from 'utils/lib/fhir/helpers';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { otherColors, palette } from 'utils/lib/theme/billing-palette';
import { ClaimAcknowledgmentEvent } from 'utils/lib/types/data/billing/claim-history';
import { formatCurrency, formatTaxId } from 'utils/lib/utils/convert';
import { deriveClaimBillablePeriod, getClaimPcn } from '../../billing/shared';
import { loadPdfAssets, StyleFactory } from './pdf-common';
import { PDF_CLIENT_STYLES } from './pdf-consts';
import { createPdfClient, hexColor, SEPARATED_LINE_STYLE, splitLongStringToPageSize } from './pdf-utils';
import { AssetPaths, PdfClient, PdfStyles, TextStyle } from './types';

export const TIMELY_FILING_CONFIDENTIALITY_STATEMENT =
  'CONFIDENTIAL — CONTAINS PROTECTED HEALTH INFORMATION (PHI). This document is an internal reference ' +
  'copy only. Do not transmit to the payer or any external party until it has been reviewed and approved ' +
  'by authorized personnel.';

const REPORT_TIMEZONE = 'America/New_York';
const REPORT_TIMEZONE_LABEL = 'ET';
const HEADER_DATE_FORMAT = 'MM/dd/yyyy hh:mm a';
const ROW_DATE_FORMAT = 'MM/dd/yy hh:mm a';
const NOT_AVAILABLE = 'N/A';

const COLUMN_GAP = 20;
const CELL_PADDING_X = 6;
const CELL_PADDING_Y = 6;
const LINE_GAP = 2;
const WRAP_SAFETY = 8;
const SECTION_GAP = 14;
const DATE_COLUMN_RATIO = 0.22;
const ENTITY_COLUMN_RATIO = 0.17;

export interface TimelyFilingReportField {
  label: string;
  value: string;
}

export interface TimelyFilingReportRow {
  dateTime: string;
  entity: string;
  event: string;
}

export interface TimelyFilingReportData {
  reportGeneratedAt: string;
  payerName: string;
  fields: TimelyFilingReportField[];
  history: TimelyFilingReportRow[];
}

export interface TimelyFilingTransmitEvent {
  transmittedAt: string;
  batchId?: string;
  clearinghouseClaimId?: string;
}

export interface ComposeTimelyFilingReportInput {
  claim: Claim;
  patient?: Patient;
  billingProvider?: Practitioner | Organization;
  renderingProvider?: Practitioner | Organization;
  coverage?: Coverage;
  payer?: Organization;
  acknowledgments: ClaimAcknowledgmentEvent[];
  transmit?: TimelyFilingTransmitEvent;
  eraPayerClaimControlNumber?: string;
  now: string;
}

const timelyFilingAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Medium.ttf',
    heavy: './assets/Rubik-Bold.otf',
  },
};

const TEXT_COLOR = hexColor(palette.text.primary);
const MUTED_COLOR = hexColor(palette.text.secondary);
const BANNER_BACKGROUND = hexColor(palette.background.default);
const HEADER_BACKGROUND = hexColor(palette.primary.dark);
const HEADER_TEXT_COLOR = hexColor(palette.primary.contrastText);
const STRIPE_BACKGROUND = hexColor(otherColors.sidebarItemHover);

/**
 * Style keys are resolved by string at render time and are NOT type-checked, so this factory must
 * define every key referenced below. Do not rely on keys defined by other documents.
 */
const createTimelyFilingStyles: StyleFactory = (assets) => ({
  textStyles: {
    banner: {
      fontSize: 9,
      font: assets.fonts.bold,
      color: TEXT_COLOR,
      spacing: 2,
      newLineAfter: true,
    },
    title: {
      fontSize: 22,
      font: assets.fonts.heavy,
      color: TEXT_COLOR,
      spacing: 4,
      newLineAfter: true,
    },
    subtitle: {
      fontSize: 11,
      font: assets.fonts.regular,
      color: MUTED_COLOR,
      spacing: 4,
      newLineAfter: true,
    },
    payerName: {
      fontSize: 14,
      font: assets.fonts.bold,
      color: TEXT_COLOR,
      spacing: 4,
      newLineAfter: true,
    },
    sectionHeading: {
      fontSize: 14,
      font: assets.fonts.bold,
      color: TEXT_COLOR,
      spacing: 4,
      newLineAfter: true,
    },
    blurb: {
      fontSize: 10,
      font: assets.fonts.regular,
      color: TEXT_COLOR,
      spacing: 3,
      newLineAfter: true,
    },
    fieldLabel: {
      fontSize: 9,
      font: assets.fonts.bold,
      color: TEXT_COLOR,
      spacing: 3,
      newLineAfter: false,
    },
    fieldValue: {
      fontSize: 9,
      font: assets.fonts.regular,
      color: TEXT_COLOR,
      spacing: 3,
      newLineAfter: false,
    },
    tableHeader: {
      fontSize: 9,
      font: assets.fonts.bold,
      color: HEADER_TEXT_COLOR,
      spacing: 2,
      newLineAfter: false,
    },
    tableCell: {
      fontSize: 9,
      font: assets.fonts.regular,
      color: TEXT_COLOR,
      spacing: 2,
      newLineAfter: false,
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

const formatReportDateTime = (iso: string, format: string): string => {
  const parsed = DateTime.fromISO(iso, { zone: REPORT_TIMEZONE });
  return parsed.isValid ? `${parsed.toFormat(format)} ${REPORT_TIMEZONE_LABEL}` : iso;
};

const formatRowDateTime = (iso: string): string => {
  const parsed = DateTime.fromISO(iso, { zone: REPORT_TIMEZONE });
  return parsed.isValid ? parsed.toFormat(ROW_DATE_FORMAT) : iso;
};

const displayName = (resource: Patient | Practitioner | Organization | undefined): string => {
  if (!resource) return '';
  if (resource.resourceType === 'Organization') return resource.name ?? '';
  const name = resource.name?.[0];
  if (!name) return '';
  return [name.given?.join(' '), name.family].filter(Boolean).join(' ');
};

const formatServiceDates = (claim: Claim): string => {
  const period = deriveClaimBillablePeriod(claim.item) ?? claim.billablePeriod;
  const start = DateTime.fromISO(period?.start ?? '');
  const end = DateTime.fromISO(period?.end ?? '');
  if (!start.isValid) return NOT_AVAILABLE;
  const startText = start.toFormat('MM/dd/yyyy');
  return end.isValid ? `${startText} - ${end.toFormat('MM/dd/yyyy')}` : startText;
};

const orNotAvailable = (value: string | undefined): string => (value?.trim() ? value.trim() : NOT_AVAILABLE);

const transmitRow = (transmit: TimelyFilingTransmitEvent, payerName: string): TimelyFilingReportRow => {
  const target = payerName ? ` to ${payerName}` : '';
  const claimId = transmit.clearinghouseClaimId ? ` #${transmit.clearinghouseClaimId}` : '';
  const batch = transmit.batchId ? ` — Batch ID: ${transmit.batchId}` : '';
  return {
    dateTime: formatRowDateTime(transmit.transmittedAt),
    entity: 'claim.md',
    event: `Transmit${claimId}${target}${batch}`,
  };
};

const acknowledgmentRow = (acknowledgment: ClaimAcknowledgmentEvent): TimelyFilingReportRow => {
  const references = [
    acknowledgment.entityKind === 'payer' && acknowledgment.payerClaimControlNumber
      ? `Claim ID: ${acknowledgment.payerClaimControlNumber}`
      : undefined,
    acknowledgment.entityKind === 'clearinghouse' && acknowledgment.clearinghouseClaimId
      ? `ID: ${acknowledgment.clearinghouseClaimId}`
      : undefined,
  ].filter(Boolean);
  return {
    dateTime: formatRowDateTime(acknowledgment.eventTime),
    entity: acknowledgment.entityName,
    event: [acknowledgment.message, ...references].join(' '),
  };
};

/**
 * Turns a claim and its acknowledgment trail into the rows and header fields the report prints.
 * Pure, so the report's content can be asserted without rendering a PDF.
 */
export function composeTimelyFilingReportData(input: ComposeTimelyFilingReportInput): TimelyFilingReportData {
  const { claim, patient, billingProvider, renderingProvider, coverage, payer, acknowledgments, transmit } = input;
  const payerDisplayName = payer?.name ?? '';
  // The payer's own control number is the one an appeal quotes; an ERA only stands in for it.
  const payerClaimControlNumber =
    acknowledgments.find(
      (acknowledgment) => acknowledgment.entityKind === 'payer' && acknowledgment.payerClaimControlNumber
    )?.payerClaimControlNumber ?? input.eraPayerClaimControlNumber;
  const batchId = transmit?.batchId ?? acknowledgments.find((event) => event.batchId)?.batchId;
  const taxId = billingProvider ? getTaxID(billingProvider) : undefined;

  const history = [
    ...(transmit ? [transmitRow(transmit, payerDisplayName)] : []),
    ...acknowledgments.map(acknowledgmentRow),
  ];

  return {
    reportGeneratedAt: formatReportDateTime(input.now, HEADER_DATE_FORMAT),
    payerName: orNotAvailable(payerDisplayName),
    fields: [
      {
        label: 'Payer Claim Control ID',
        value: orNotAvailable(payerClaimControlNumber),
      },
      {
        label: 'Clearinghouse Batch Number',
        value: orNotAvailable(batchId),
      },
      {
        label: 'Billing Provider Tax ID',
        value: taxId ? formatTaxId(taxId) : NOT_AVAILABLE,
      },
      {
        label: 'Billing Provider NPI',
        value: orNotAvailable(billingProvider && getNPI(billingProvider)),
      },
      {
        label: 'Billing Provider Name',
        value: orNotAvailable(displayName(billingProvider)),
      },
      {
        label: 'Rendering Provider NPI',
        value: orNotAvailable(renderingProvider && getNPI(renderingProvider)),
      },
      {
        label: 'Patient Name',
        value: orNotAvailable(displayName(patient)),
      },
      {
        label: 'Insured ID',
        value: orNotAvailable(coverage?.subscriberId),
      },
      {
        label: 'Patient Control Number',
        value: orNotAvailable(getClaimPcn(claim)),
      },
      {
        label: 'Service Dates',
        value: formatServiceDates(claim),
      },
      {
        label: 'Clearinghouse Payer ID',
        value: orNotAvailable(payer && getPayerId(payer)),
      },
      {
        label: 'Claim Total Amount',
        value: claim.total?.value === undefined ? NOT_AVAILABLE : formatCurrency(claim.total.value),
      },
    ],
    history,
  };
}

const fontMetrics = (style: TextStyle): { ascent: number; descent: number; lineHeight: number } => {
  const full = style.font.heightAtSize(style.fontSize);
  const ascent = style.font.heightAtSize(style.fontSize, { descender: false });
  return {
    ascent,
    descent: full - ascent,
    lineHeight: full + LINE_GAP,
  };
};

const drawConfidentialityBanner = (pdfClient: PdfClient, styles: PdfStyles): void => {
  const style = styles.textStyles.banner;
  const { ascent, descent, lineHeight } = fontMetrics(style);
  const left = pdfClient.getLeftBound();
  const width = pdfClient.getRightBound() - left;
  const lines = splitLongStringToPageSize(
    TIMELY_FILING_CONFIDENTIALITY_STATEMENT,
    style.font,
    style.fontSize,
    width - CELL_PADDING_X * 2 - WRAP_SAFETY
  );
  const height = lines.length * lineHeight - LINE_GAP + CELL_PADDING_Y * 2;
  const top = pdfClient.getY() + ascent;

  pdfClient.drawFilledRectangle({
    x: left,
    y: top - height,
    width,
    height,
    color: BANNER_BACKGROUND,
  });
  lines.forEach((line, index) => {
    pdfClient.setY(top - CELL_PADDING_Y - ascent - index * lineHeight);
    pdfClient.drawStartXPosSpecifiedText(line, style, left + CELL_PADDING_X, {
      leftBound: left + CELL_PADDING_X,
      rightBound: left + width - CELL_PADDING_X,
    });
  });
  pdfClient.setY(top - height - descent - SECTION_GAP);
};

const drawFieldGrid = (pdfClient: PdfClient, styles: PdfStyles, fields: TimelyFilingReportField[]): void => {
  const labelStyle = styles.textStyles.fieldLabel;
  const valueStyle = styles.textStyles.fieldValue;
  const { lineHeight } = fontMetrics(labelStyle);
  const left = pdfClient.getLeftBound();
  const columnWidth = (pdfClient.getRightBound() - left - COLUMN_GAP) / 2;

  const valueOffsets = [0, 1].map(
    (column) =>
      Math.max(
        ...fields
          .filter((_, index) => index % 2 === column)
          .map((field) => pdfClient.getTextDimensions(`${field.label}:`, labelStyle).width)
      ) + 8
  );

  for (let index = 0; index < fields.length; index += 2) {
    const top = pdfClient.getY();
    let usedLines = 1;
    [fields[index], fields[index + 1]].forEach((field, column) => {
      if (!field) return;
      const columnLeft = left + column * (columnWidth + COLUMN_GAP);
      const valueLeft = columnLeft + valueOffsets[column];
      pdfClient.setY(top);
      pdfClient.drawStartXPosSpecifiedText(`${field.label}:`, labelStyle, columnLeft, {
        leftBound: columnLeft,
        rightBound: valueLeft,
      });
      const lines = splitLongStringToPageSize(
        field.value,
        valueStyle.font,
        valueStyle.fontSize,
        columnLeft + columnWidth - valueLeft - WRAP_SAFETY
      );
      usedLines = Math.max(usedLines, lines.length);
      lines.forEach((line, lineIndex) => {
        pdfClient.setY(top - lineIndex * lineHeight);
        pdfClient.drawStartXPosSpecifiedText(line, valueStyle, valueLeft, {
          leftBound: valueLeft,
          rightBound: columnLeft + columnWidth,
        });
      });
    });
    pdfClient.setY(top - usedLines * lineHeight - 4);
  }
};

const drawHistoryTable = (pdfClient: PdfClient, styles: PdfStyles, rows: TimelyFilingReportRow[]): void => {
  const headerStyle = styles.textStyles.tableHeader;
  const cellStyle = styles.textStyles.tableCell;
  const left = pdfClient.getLeftBound();
  const tableWidth = pdfClient.getRightBound() - left;
  const widths = [
    tableWidth * DATE_COLUMN_RATIO,
    tableWidth * ENTITY_COLUMN_RATIO,
    tableWidth * (1 - DATE_COLUMN_RATIO - ENTITY_COLUMN_RATIO),
  ];
  const offsets = widths.map((_, index) => left + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
  const bottomMargin = PDF_CLIENT_STYLES.initialPage.pageMargins.bottom ?? 0;

  const headerCells = [`DATE / TIME (${REPORT_TIMEZONE_LABEL})`, 'ENTITY', 'EVENT'];

  const drawRow = (cells: string[], style: TextStyle, background?: Color, isHeader = false): void => {
    const { ascent, lineHeight } = fontMetrics(style);
    const lineSets = cells.map((text, index) =>
      splitLongStringToPageSize(text, style.font, style.fontSize, widths[index] - CELL_PADDING_X * 2 - WRAP_SAFETY)
    );
    const lineCount = Math.max(...lineSets.map((lines) => lines.length));
    const height = lineCount * lineHeight - LINE_GAP + CELL_PADDING_Y * 2;

    let top = pdfClient.getY() + ascent;
    if (top - height - lineHeight < bottomMargin) {
      pdfClient.addNewPage(PDF_CLIENT_STYLES.initialPage);
      // draw header on new pages
      if (!isHeader) drawHeader();
      top = pdfClient.getY() + ascent;
    }

    if (background) {
      pdfClient.drawFilledRectangle({
        x: left,
        y: top - height,
        width: tableWidth,
        height,
        color: background,
      });
    }
    lineSets.forEach((lines, column) => {
      lines.forEach((line, index) => {
        pdfClient.setY(top - CELL_PADDING_Y - ascent - index * lineHeight);
        pdfClient.drawStartXPosSpecifiedText(line, style, offsets[column] + CELL_PADDING_X, {
          leftBound: offsets[column] + CELL_PADDING_X,
          rightBound: offsets[column] + widths[column] - CELL_PADDING_X,
        });
      });
    });
    pdfClient.setY(top - height - ascent);
  };

  const drawHeader = (): void => drawRow(headerCells, headerStyle, HEADER_BACKGROUND, true);

  drawHeader();
  if (rows.length === 0) {
    drawRow([NOT_AVAILABLE, NOT_AVAILABLE, 'No acknowledgments received for this claim.'], cellStyle);
    return;
  }
  rows.forEach((row, index) => {
    drawRow([row.dateTime, row.entity, row.event], cellStyle, index % 2 === 1 ? STRIPE_BACKGROUND : undefined);
  });
};

export async function renderTimelyFilingReportPdf(data: TimelyFilingReportData): Promise<Uint8Array> {
  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
  const assets = await loadPdfAssets(pdfClient, timelyFilingAssetPaths);
  const styles = createTimelyFilingStyles(assets);

  drawConfidentialityBanner(pdfClient, styles);

  pdfClient.drawText('Timely Filing Report', styles.textStyles.title);
  pdfClient.drawText(`Report as of: ${data.reportGeneratedAt}`, styles.textStyles.subtitle);
  pdfClient.drawText(`Payer Name: ${data.payerName}`, styles.textStyles.payerName);
  pdfClient.drawSeparatedLine(styles.lineStyles.separator);

  drawFieldGrid(pdfClient, styles, data.fields);
  pdfClient.drawSeparatedLine(styles.lineStyles.separator);

  pdfClient.newLine(SECTION_GAP);
  pdfClient.drawText('Claim History', styles.textStyles.sectionHeading);
  pdfClient.drawText(
    'Full filing and acknowledgment trail for this claim across the practice, clearinghouse, and payer systems.',
    styles.textStyles.blurb
  );
  pdfClient.newLine(SECTION_GAP);
  drawHistoryTable(pdfClient, styles, data.history);

  pdfClient.numberPages(styles.textStyles.footer);
  return await pdfClient.save();
}
