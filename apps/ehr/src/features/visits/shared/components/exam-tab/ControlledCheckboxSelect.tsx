import { Box, ListItemText, MenuItem, Select } from '@mui/material';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

export type ControlledCheckboxSelectOptionType = { label: string; name: string; description?: string };

type ControlledCheckboxSelectProps = {
  label: string;
  name: string;
  options: ControlledCheckboxSelectOptionType[];
};

export const ControlledCheckboxSelect: FC<ControlledCheckboxSelectProps> = (props) => {
  const { label, name, options } = props;

  const params = [name].concat(options.map((option) => option.name));
  const { value, update, isLoading } = useExamObservations(params);
  // appointments made before https://github.com/masslight/ottehr/issues/4055 is ready might have some undefined fields
  const fields = value.filter((field) => field !== undefined);

  // Create a stable serialized representation of field states to detect actual data changes
  const fieldsState = useMemo(
    () =>
      fields
        .map((f) => `${f.field}:${f.value}`)
        .sort()
        .join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value] // Depend on value from useExamObservations hook
  );

  const [booleanValue, setBooleanValue] = useState(() => fields.some((field) => field.value === true));

  // Track if user is actively interacting to prevent sync conflicts
  const isUserInteractingRef = useRef(false);

  // Sync local state when server data changes (e.g., after applying template)
  useEffect(() => {
    // Don't sync if user is actively clicking
    if (!isUserInteractingRef.current) {
      const hasCheckedFields = fields.some((field) => field.value === true);
      setBooleanValue(hasCheckedFields);
    }
  }, [fieldsState, fields]); // Depend on both to ensure updates

  const onCheckboxChange = (newValue: boolean): void => {
    // Mark that user is interacting
    isUserInteractingRef.current = true;

    // Immediately update local state to reflect user action
    setBooleanValue(newValue);

    // Then update server data
    if (newValue === false) {
      // User unchecked - clear all selected options
      const fieldsToUpdate = fields.filter((field) => field.value === true);
      if (fieldsToUpdate.length > 0) {
        update(fieldsToUpdate.map((field) => ({ ...field, value: false })));
      }
    } else {
      // User checked - update the main checkbox field
      const field = fields.find((f) => f.field === name);
      if (field) {
        update({ ...field, value: newValue });
      }
    }

    // Reset interaction flag after update completes
    setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 100);
  };

  const selectedFields = fields.filter((field) => field.value === true).map((field) => field.field);
  const showSelected = options.some((option) => !!option.description);
  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <StatelessExamCheckbox
          label={label}
          checked={booleanValue}
          onChange={onCheckboxChange}
          abnormal
          disabled={isLoading}
        />
        {booleanValue && (
          <Select
            size="small"
            multiple
            value={fields
              .filter((field) => field.field !== name)
              .filter((field) => field.value === true)
              .map((field) => field.field)}
            onChange={(event) => {
              const selectedFields = event.target.value as string[];
              const fieldsToUpdate = fields.filter((field) => {
                const fieldValues = fields.find((f) => f.field !== name && f.field === field.field)?.value;
                return selectedFields.includes(field.field) ? !fieldValues : fieldValues;
              });
              update(fieldsToUpdate.map((field) => ({ ...field, value: !field.value })));
            }}
            renderValue={(selected) =>
              selected
                .map((selectedOption) => options.find((option) => option.name === selectedOption)?.label)
                .join(', ')
            }
          >
            {options.map((option) => (
              <MenuItem key={option.name} value={option.name} disabled={isLoading}>
                <StatelessExamCheckbox
                  checked={fields.find((field) => field.field === option.name)?.value}
                  abnormal
                  disabled={isLoading}
                />
                <ListItemText
                  primary={option.label}
                  primaryTypographyProps={{
                    sx: {
                      fontWeight: fields.find((field) => field.field === option.name)?.value ? 'bold' : 'normal',
                    },
                  }}
                />
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>
      {showSelected &&
        selectedFields.map((field) => (
          <Box key={field}>
            <ListItemText
              primary={options.find((option) => option.name === field)?.label}
              secondary={options.find((option) => option.name === field)?.description}
            />
          </Box>
        ))}
    </Box>
  );
};
