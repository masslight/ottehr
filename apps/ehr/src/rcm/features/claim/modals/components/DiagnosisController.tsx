import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { DiagnosesField } from 'src/features/visits/shared/components/assessment-tab/DiagnosesField';

type DiagnosisControllerProps = {
  name: string;
};

export const DiagnosisController: FC<DiagnosisControllerProps> = (props) => {
  const { name } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: true }}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <DiagnosesField
          onChange={onChange}
          value={value}
          disableForPrimary={false}
          error={error}
          label="Diagnosis"
          placeholder="Search diagnosis code"
        />
      )}
    />
  );
};
