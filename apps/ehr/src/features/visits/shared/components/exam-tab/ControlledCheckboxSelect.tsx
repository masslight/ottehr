import { Box, ListItemText, MenuItem, Select } from '@mui/material';
import { FC, useState } from 'react';
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

  const onCheckboxChange = (value: boolean): void => {
    setBooleanValue(!booleanValue);
    // if the checkbox is unchecked, update options
    if (value === false) {
      // get fields that are checked and update them to be unchecked
      const fieldsToUpdate = fields.filter((field) => field.value === true);
      if (fieldsToUpdate.length > 0) {
        update(fieldsToUpdate.map((field) => ({ ...field, value: false })));
      }
    } else {
      // if the checkbox is checked, update only the checkbox
      const field = fields.filter((field) => field.field === name)?.[0];
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
