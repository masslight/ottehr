import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';

// modified from https://github.com/mui/material-ui/issues/30591#issuecomment-1377997824
export class CustomAdapterLuxon extends AdapterLuxon {
  ordinalMap: { [ord: number]: DateTime[][] } = {};
  // labels for the top
  public getWeekdays = (): string[] => {
    const { t } = useTranslation();
    return t('general.weekdays', { returnObjects: true });
  };

  getWeekArray = (date: DateTime): DateTime[][] => {
    const memoized = this.ordinalMap[date.ordinal];
    if (memoized) {
      return memoized;
    }

    const { days } = date.endOf('month').endOf('week').diff(date.startOf('month').startOf('week'), 'days').toObject();

    let weeks: DateTime[][] = [];
    new Array(Math.round(days ?? 0))
      .fill(0)
      .map((_, i) => i)
      .map((day) => date.startOf('month').startOf('week').minus({ days: 1 }).plus({ days: day }))
      .forEach((v, i) => {
        if (i === 0 || (i % 7 === 0 && i > 6)) {
          weeks.push([v]);
          return;
        }

        weeks[weeks.length - 1].push(v);
      });

    weeks = weeks.filter((week) => {
      // do not allow weeks with start or end outside of current month
      return week[0].hasSame(date, 'month') || week[week.length - 1].hasSame(date, 'month');
    });

    return weeks;
  };
}
