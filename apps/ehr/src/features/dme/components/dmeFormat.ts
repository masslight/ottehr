import { formatDate } from 'utils/lib/utils/date';

export const formatDmeDateTime = (iso: string | undefined): string =>
  iso ? formatDate(iso, 'MM/dd/yyyy hh:mm a') : '';
