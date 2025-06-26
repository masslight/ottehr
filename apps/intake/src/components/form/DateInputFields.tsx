import { FormControl, Grid, Input, InputBaseProps, InputLabel, MenuItem, Select, useMediaQuery } from '@mui/material';
import { RefCallBack } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { months } from 'utils';
import { breakpoints } from '../../providers/IntakeThemeProviderBase';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';

interface DateInputFieldProps extends InputBaseProps {
  selectedMonth: string;
  selectedDay: string;
  selectedYear: string;
  required?: boolean;
  label?: string;
  error?: boolean;
  setSelectedMonth: (month: string) => void;
  setSelectedYear: (year: string) => void;
  setSelectedDay: (day: string) => void;
  inputRef?: RefCallBack;
  dayRef?: RefCallBack;
  monthRef?: RefCallBack;
  yearRef?: RefCallBack;
}

const useYearLabel = (): string => {
  const { t } = useTranslation();
  return t('aboutPatient.birthDate.placeholderYear');
};
const useMonthLabel = (): string => {
  const { t } = useTranslation();
  return t('aboutPatient.birthDate.placeholderMonth');
};
const useDayLabel = (): string => {
  const { t } = useTranslation();
  return t('aboutPatient.birthDate.placeholderDay');
};

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const startYear = 1900;

const days = Array.from({ length: 31 }, (_, index) => {
  const day: number = index + 1;
  return { value: day < 10 ? `0${day}` : `${day}`, label: `${day}` };
});

const years = Array.from({ length: currentYear - startYear + 1 }, (_, index) => {
  const year: number = startYear + index;
  return { value: `${year}`, label: `${year}` };
}).reverse();

const getTranslatedMonthLabel = (monthLabel: string): string => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = useTranslation();

  switch (monthLabel) {
    case 'Jan':
      return t('general.monthsShortened.jan');
    case 'Feb':
      return t('general.monthsShortened.feb');
    case 'Mar':
      return t('general.monthsShortened.mar');
    case 'Apr':
      return t('general.monthsShortened.apr');
    case 'May':
      return t('general.monthsShortened.may');
    case 'Jun':
      return t('general.monthsShortened.jun');
    case 'Jul':
      return t('general.monthsShortened.jul');
    case 'Aug':
      return t('general.monthsShortened.aug');
    case 'Sep':
      return t('general.monthsShortened.sep');
    case 'Oct':
      return t('general.monthsShortened.oct');
    case 'Nov':
      return t('general.monthsShortened.nov');
    case 'Dec':
      return t('general.monthsShortened.dec');
    default:
      return monthLabel;
  }
};

const DateInputFields = ({
  required,
  selectedMonth,
  selectedDay,
  selectedYear,
  label,
  error,
  inputRef, // to facilitate scroll-into-frame on error
  monthRef,
  yearRef,
  dayRef,
  setSelectedMonth,
  setSelectedYear,
  setSelectedDay,
  disabled,
}: DateInputFieldProps): JSX.Element => {
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.values?.sm}px)`);
  return (
    <FormControl required={required} sx={{ width: '100%' }} hiddenLabel={label === undefined}>
      {inputRef && <Input hidden={false} inputRef={inputRef} sx={{ height: '0px', width: '0px' }} />}
      {label && (
        <BoldPurpleInputLabel shrink key="input_label">
          {label}
        </BoldPurpleInputLabel>
      )}
      <Grid
        container
        mt={label ? 2 : 0}
        spacing={2}
        rowGap={2}
        direction={isMobile ? 'column' : 'row'}
        key="input_grid"
        sx={{
          '& .MuiGrid-item': {
            marginTop: isMobile ? 2 : 0,
            paddingTop: 0,
          },
        }}
      >
        <Grid item md={4} xs={12}>
          <FormControl required={required} sx={{ width: '100%' }} hiddenLabel={true} disabled={disabled}>
            <InputLabel>{useMonthLabel()}</InputLabel>
            <Select
              label="Month"
              inputRef={monthRef}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              error={error}
            >
              {months.map((month) => (
                <MenuItem key={`month-${month.value}`} value={month.value}>
                  {getTranslatedMonthLabel(month.label)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item md={4} xs={12}>
          <FormControl required={required} sx={{ width: '100%' }} hiddenLabel={true} disabled={disabled}>
            <InputLabel>{useDayLabel()}</InputLabel>
            <Select
              label="Day"
              inputRef={dayRef}
              error={error}
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {days.map((day) => (
                <MenuItem key={`day-${day.value}`} value={day.value}>
                  {day.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item md={4} xs={12}>
          <FormControl required={required} sx={{ width: '100%' }} hiddenLabel={true} disabled={disabled}>
            <InputLabel>{useYearLabel()}</InputLabel>
            <Select
              label="Year"
              inputRef={yearRef}
              value={selectedYear}
              error={error}
              onChange={(e: any) => setSelectedYear?.(e.target.value)}
            >
              {years.map((year) => (
                <MenuItem key={`year-${year.value}`} value={year.value}>
                  {year.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </FormControl>
  );
};

export default DateInputFields;
