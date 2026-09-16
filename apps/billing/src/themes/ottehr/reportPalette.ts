import { InvoiceReportCategory } from 'utils/lib/types/data/billing/billing.types';
import { palette } from './colors';

// Shared visual vocabulary for the report pages. react-google-charts needs concrete hex
// values at render time, so chart series live here as named tokens — derived from the app
// palette where semantics align — rather than as an MUI theme extension.

// categorical chart accents with no MUI-palette equivalent
const chartBlue = '#3F79C1';
const chartGreen = '#7FB069';
const chartPurple = '#8464A9';
const chartAmber = '#E2A54B';
const accentPurple = '#7B61D9';

export const reportPalette = {
  // muted chrome for drilldown table heads, totals cells, and expanded panels
  mutedBg: '#FAFAFA',
  // selected/active summary card
  activeCardBg: '#EEF4FB',
  activeCardBorder: chartBlue,

  // low → high severity ramp for receivables aging, oldest bucket last
  agingBuckets: ['#1E88E5', '#00897B', '#7CB342', '#FDD835', palette.warning.main, '#E53935'],
  agingNotYetDue: '#9E9E9E',

  invoiceCategory: {
    upcoming: palette.success.main,
    'past-due-no-card': '#ED6C02',
    'past-due-not-attempted': accentPurple,
    'past-due-failed': palette.error.main,
  } satisfies Record<InvoiceReportCategory, string>,

  // paired series for the payments overview cards
  paymentsOverview: [chartBlue, chartGreen],
  allowedOverview: [chartPurple, chartAmber],

  pipeline: {
    noStatus: '#9AA1AC',
    statusSeries: [palette.warning.main, palette.primary.main, accentPurple, palette.success.main],
  },
};
