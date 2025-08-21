import { Box, ListItemText, MenuItem, Select } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

export type ControlledCheckboxSelectOptionType = { label: string; name: string; description?: string };

type ControlledCheckboxSelectProps = {
  label: string;
  options: ControlledCheckboxSelectOptionType[];
};

export const ControlledCheckboxSelect: FC<ControlledCheckboxSelectProps> = (props) => {
  const { label, options } = props;

  const { value: fields, update, isLoading } = useExamObservations(options.map((option) => option.name));

  const [booleanValue, setBooleanValue] = useState(fields.some((field) => field.value === true));

  useEffect(() => {
    if (fields.some((field) => field.value === true)) {
      setBooleanValue(true);
    }
  }, [fields]);

  const onCheckboxChange = (): void => {
    setBooleanValue(!booleanValue);
    const fieldsToUpdate = fields.filter((field) => field.value === true);
    if (booleanValue && fieldsToUpdate.length > 0) {
      update(fieldsToUpdate.map((field) => ({ ...field, value: !field.value })));
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
            value={fields.filter((field) => field.value === true).map((field) => field.field)}
            onChange={(event) => {
              const selectedFields = event.target.value as string[];
              const fieldsToUpdate = fields.filter((field) => {
                const fieldValues = fields.find((f) => f.field === field.field)?.value;
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
