import { FC } from 'react';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type ControlledExamCheckboxProps = {
  label: string;
  name: string;
  abnormal?: boolean;
};

export const ControlledExamCheckbox: FC<ControlledExamCheckboxProps> = (props) => {
  const { label, name, abnormal } = props;

  const { value: field, update, isLoading } = useExamObservations(name);

  const onChange = (value: boolean): void => {
    update({ ...field, value });
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
