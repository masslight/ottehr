import { SelectInput } from './index';

interface DateInputFieldProps {
  name: string;
  required?: boolean;
  label?: string;
  helperText?: string;
  placeholder?: string;
  infoTextSecondary?: string;
  defaultValue: string | undefined;
  setCurrentValue: (newVal: string | undefined) => void;
}

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const startYear = 1900;

const years = Array.from({ length: currentYear - startYear + 1 }, (_, index) => {
  const year: number = startYear + index;
  return { value: `${year}`, label: `${year}` };
}).reverse();

const CoalescedDateInput = ({
  name,
  required,
  defaultValue,
  label,
  helperText,
  placeholder,
  infoTextSecondary,
  setCurrentValue,
}: DateInputFieldProps): JSX.Element => {
  return (
    <SelectInput
      name={name}
      label={label || 'No label'}
      helperText={helperText}
      placeholder={placeholder}
      defaultValue={defaultValue}
      required={required}
      options={years}
      infoTextSecondary={infoTextSecondary}
      onChange={(event) => {
        const target = event.target as HTMLInputElement;
        setCurrentValue(target.value);
      }}
    />
  );
};

export default CoalescedDateInput;
