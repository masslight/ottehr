import { DateTime } from 'luxon';
import { mdyStringFromISOString } from 'utils';

export const yupDateTransform = (d: any): string => {
  try {
    return mdyStringFromISOString(d || '');
  } catch {
    return d;
  }
};

export function getLocaleDateTimeString(
  dateTime: DateTime | undefined,
  format: 'full' | 'medium' | 'weekday' | 'short' | 'birthday',
  language: string
): string {
  if (dateTime == null) {
    return '';
  }
  let dateFormat = '';
  switch (format) {
    case 'full':
      dateFormat = 'DDD, h:mm a ZZZZ';
      break;
    case 'medium':
      dateFormat = 'MMMM d, h:mm a ZZZZ';
      break;
    case 'short':
      dateFormat = 'DD';
      break;
    case 'weekday':
      dateFormat = 'DDDD';
      break;
    case 'birthday':
      dateFormat = 'MMMM d, yyyy';
      break;
  }
  const locale = language.split('-')[0] === 'es' ? 'es-US' : 'en-US';
  const dateTimeString = dateTime.setLocale(locale).toFormat(dateFormat);
  return dateTimeString;
}
