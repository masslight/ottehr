import { Box, ListItemText, MenuItem, Select } from '@mui/material';
import { FC, useEffect, useState } from 'react';
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
  const [booleanValue, setBooleanValue] = useState(fields.some((field) => field.value === true));

  // Sync booleanValue with fields state to ensure UI reflects actual data
  useEffect(() => {
    const hasSelectedFields = fields.some((field) => field.value === true);
    setBooleanValue(hasSelectedFields);
  }, [fields]);

  const onCheckboxChange = (value: boolean): void => {
    setBooleanValue(value);
    if (value === false) {
      // When unchecking, set all selected fields to value: false
      // Use update instead of delete to prevent 410 Gone errors
      const fieldsToUncheck = fields.filter((field) => field.value === true);

      if (fieldsToUncheck.length > 0) {
        update(fieldsToUncheck.map((field) => ({ ...field, value: false })));
      }
    } else {
      // When checking, update only the main checkbox field
      const field = fields.find((field) => field.field === name);

      if (field) {
        update({ ...field, value });
      }
    }
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
              // Get option fields (exclude main checkbox field)
              const optionFields = fields.filter((field) => field.field !== name);

              // Determine which options to add: in selectedFields but not currently selected
              const fieldsToAdd = optionFields.filter(
                (field) => selectedFields.includes(field.field) && field.value === false
              );

              // Determine which options to remove: currently selected but not in selectedFields
              const fieldsToRemove = optionFields.filter(
                (field) => !selectedFields.includes(field.field) && field.value === true
              );

              // Combine all changes into a single update call
              const allFieldsToUpdate = [
                ...fieldsToAdd.map((field) => ({ ...field, value: true })),
                ...fieldsToRemove.map((field) => ({ ...field, value: false })),
              ];

              if (allFieldsToUpdate.length > 0) {
                update(allFieldsToUpdate);
              }
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
