import { TextField } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { StyledQuestionnaireItem } from '../useStyleItems';

interface DecimalInputProps {
  item: StyledQuestionnaireItem;
  value: number | string;
  fieldId: string;
  onChange: (e: { target: { value: string } }) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  error?: boolean;
  disabled?: boolean;
}

const DecimalInput: FC<DecimalInputProps> = ({ item, value, fieldId, onChange, inputRef, error, disabled }) => {
  // Use local state to preserve user input including trailing decimals
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === '' || value === undefined || value === null) return '';
    return String(value);
  });

  // Sync local state when external value changes (e.g., from form reset)
  useEffect(() => {
    const externalStr = value === '' || value === undefined || value === null ? '' : String(value);
    // Only update if the numeric values differ (preserves local formatting during typing)
    const localNumeric = parseFloat(displayValue);
    const externalNumeric = parseFloat(externalStr);
    if (displayValue === '' && externalStr === '') return;
    if (!isNaN(localNumeric) && !isNaN(externalNumeric) && localNumeric === externalNumeric) return;
    if (displayValue === '' && !isNaN(externalNumeric)) {
      setDisplayValue(externalStr);
    } else if (isNaN(localNumeric) && !isNaN(externalNumeric)) {
      setDisplayValue(externalStr);
    }
  }, [value, displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    let inputValue = e.target.value;

    // Only allow digits and at most one decimal point
    inputValue = inputValue.replace(/[^0-9.]/g, '');

    // Remove extra decimal points (keep only the first one)
    const decimalIndex = inputValue.indexOf('.');
    if (decimalIndex !== -1) {
      const beforeDecimal = inputValue.slice(0, decimalIndex + 1);
      const afterDecimal = inputValue.slice(decimalIndex + 1).replace(/\./g, '');
      inputValue = beforeDecimal + afterDecimal;
    }

    // Limit to one digit after the decimal point
    const parts = inputValue.split('.');
    if (parts.length === 2 && parts[1].length > 1) {
      inputValue = parts[0] + '.' + parts[1].charAt(0);
    }

    // Update local display state
    setDisplayValue(inputValue);

    // Propagate change to form
    onChange({ target: { value: inputValue } });
  };

  return (
    <TextField
      id={fieldId}
      value={displayValue}
      type="text"
      inputMode="decimal"
      aria-labelledby={`${item.linkId}-label`}
      aria-describedby={`${item.linkId}-helper-text`}
      placeholder={item.placeholder}
      required={item.required}
      onChange={handleChange}
      InputLabelProps={{ shrink: true }}
      inputRef={inputRef}
      InputProps={{
        disabled: disabled,
        error: error,
      }}
      sx={{
        '.MuiOutlinedInput-root': {
          borderRadius: '8px',
          height: 'auto',
          width: '100%',
          padding: '2px 2px',
          '&.Mui-focused': {
            boxShadow: '0 -0.5px 0px 3px rgba(77, 21, 183, 0.25)',
            '& fieldset': {
              borderWidth: '1px',
            },
          },
        },
      }}
      size="small"
    />
  );
};

export default DecimalInput;
