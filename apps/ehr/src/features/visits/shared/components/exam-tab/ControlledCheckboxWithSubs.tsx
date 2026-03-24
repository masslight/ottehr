import { Box } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

export type SubCheckboxOption = { label: string; name: string };

type ControlledCheckboxWithSubsProps = {
  label: string;
  name: string;
  options: SubCheckboxOption[];
  abnormal?: boolean;
};

export const ControlledCheckboxWithSubs: FC<ControlledCheckboxWithSubsProps> = ({ label, name, options, abnormal }) => {
  const params = [name].concat(options.map((o) => o.name));
  const { value, update, isLoading } = useExamObservations(params);
  const fields = value.filter((f) => f !== undefined);
  const [parentChecked, setParentChecked] = useState(fields.some((f) => f.value === true));

  useEffect(() => {
    setParentChecked(fields.some((f) => f.value === true));
  }, [fields]);

  const onParentChange = (checked: boolean): void => {
    setParentChecked(checked);
    if (!checked) {
      const fieldsToUncheck = fields.filter((f) => f.value === true);
      if (fieldsToUncheck.length > 0) {
        update(fieldsToUncheck.map((f) => ({ ...f, value: false })));
      }
    } else {
      const field = fields.find((f) => f.field === name);
      if (field) {
        update({ ...field, value: true });
      }
    }
  };

  const onSubChange = (optionName: string, checked: boolean): void => {
    const field = fields.find((f) => f.field === optionName);
    if (field) {
      update({ ...field, value: checked });
    }
  };

  return (
    <Box>
      <StatelessExamCheckbox
        label={label}
        checked={parentChecked}
        onChange={onParentChange}
        abnormal={abnormal}
        disabled={isLoading}
      />
      {parentChecked && (
        <Box sx={{ pl: 3.5, display: 'flex', flexDirection: 'column' }}>
          {options.map((option) => (
            <StatelessExamCheckbox
              key={option.name}
              label={option.label}
              checked={fields.find((f) => f.field === option.name)?.value ?? false}
              onChange={(checked) => onSubChange(option.name, checked)}
              abnormal={abnormal}
              disabled={isLoading}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
