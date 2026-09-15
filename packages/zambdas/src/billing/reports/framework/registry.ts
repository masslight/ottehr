import { RefreshReportKind } from 'utils/lib/types/data/billing/billing.constants';
import { cardsOnFileReport } from '../definitions/cards-on-file.report';
import { invoiceReport } from '../definitions/invoice.report';
import { patientPaymentsReport } from '../definitions/patient-payments.report';
import { paymentsReport } from '../definitions/payments.report';
import { pipelineReport } from '../definitions/pipeline.report';
import { productivityReport } from '../definitions/productivity.report';
import { AnyReportDefinition } from './types';

// One entry per report kind; the HTTP zambda and the refresh worker both route through this map.
export const reportRegistry: Record<RefreshReportKind, AnyReportDefinition> = {
  payments: paymentsReport,
  'patient-payments': patientPaymentsReport,
  invoice: invoiceReport,
  'cards-on-file': cardsOnFileReport,
  pipeline: pipelineReport,
  productivity: productivityReport,
};
