import { RefreshReportKind } from 'utils/lib/types/data/billing/billing.constants';
import { AnyReportDefinition } from './types';

// One entry per report kind; the HTTP zambda and the refresh worker both route through this map.
// Report definitions are added alongside the reports themselves (see docs/billing-reports.md).
export const reportRegistry: Partial<Record<RefreshReportKind, AnyReportDefinition>> = {};
