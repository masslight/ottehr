import { FC } from 'react';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type ControlledExamCheckboxProps = {
  label: string;
  name: string;
  abnormal?: boolean;
  legacy?: boolean;
};

export const ControlledExamCheckbox: FC<ControlledExamCheckboxProps> = (props) => {
  const { label, name, abnormal, legacy } = props;

  const { value: field, update, delete: deleteField, isLoading } = useExamObservations(name);

  if (legacy && !field.value) {
    return null;
  }

  const onChange = (value: boolean): void => {
    if (value) {
      update({ ...field, value });
    } else {
      deleteField(field);
    }
  };

  return (
    <StatelessExamCheckbox
      label={label}
      abnormal={abnormal}
      checked={field.value}
      onChange={onChange}
      disabled={isLoading}
    />
  );
};
