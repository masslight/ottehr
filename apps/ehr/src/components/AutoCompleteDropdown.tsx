// Fixed AutoCompleteDropdown.tsx
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { Autocomplete, Checkbox, Chip, Popper, TextField } from '@mui/material';
import React from 'react';

interface Option {
  id: string;
  name: string;
}

interface AutoCompleteDropdownProps {
  options: Option[];
  selectedValues: string | string[];
  onChange: (value: string | string[]) => void;
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  sx?: any;
}

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

export const AutoCompleteDropdown: React.FC<AutoCompleteDropdownProps> = ({
  options,
  selectedValues,
  onChange,
  label,
  multiple = false,
  disabled = false,
  placeholder,
  sx = { width: 300 },
}) => {
  // Filter out any undefined/null options and ensure they have valid names
  const validOptions = React.useMemo((): any => {
    return (options || []).filter((option) => option && option.id && option.name && typeof option.name === 'string');
  }, [options]);

  const getSelectedOptions = (): any => {
    if (multiple) {
      return validOptions.filter((option: any) => (selectedValues as string[]).includes(option.id));
    } else {
      return validOptions.find((option: any) => option.id === selectedValues) || null;
    }
  };

  const handleChange = (event: any, newValue: any): any => {
    if (multiple) {
      const selectedIds = newValue ? newValue.map((item: Option) => item.id) : [];
      onChange(selectedIds);
    } else {
      onChange(newValue?.id || '');
    }
  };

  // Safe filter options with null checking
  const filterOptions = (options: Option[], { inputValue }: { inputValue: string }): any => {
    const validOptions = (options || []).filter((option) => option && option.name && typeof option.name === 'string');

    if (!inputValue) return validOptions;

    const searchTerm = inputValue.toLowerCase();
    return validOptions.filter((option) => option.name.toLowerCase().includes(searchTerm));
  };

  // Safe getOptionLabel function
  const getOptionLabel = (option: Option): any => {
    return option?.name || '';
  };

  return (
    <Autocomplete
      multiple={multiple}
      options={validOptions}
      disableCloseOnSelect={multiple}
      getOptionLabel={getOptionLabel}
      value={getSelectedOptions()}
      onChange={handleChange}
      disabled={disabled}
      filterOptions={filterOptions}
      PopperComponent={(props) => <Popper {...props} placement="bottom-start" />}
      slotProps={{
        popper: {
          placement: 'bottom-start',
          modifiers: [
            {
              name: 'flip',
              enabled: false,
            },
            {
              name: 'preventOverflow',
              enabled: true,
            },
          ],
        },
      }}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
      renderOption={(props, option, { selected }) => {
        if (multiple) {
          return (
            <li {...props} key={option.id}>
              <Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />
              {option.name}
            </li>
          );
        }
        return (
          <li {...props} key={option.id}>
            {option.name}
          </li>
        );
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip {...getTagProps({ index })} key={option.id} label={option.name} size="small" />
        ))
      }
      sx={sx}
      isOptionEqualToValue={(option, value) => option.id === value.id}
    />
  );
};
