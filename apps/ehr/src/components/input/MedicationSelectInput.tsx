import { useGetMedicationList } from 'src/telemed';
import { AutocompleteInput } from './AutocompleteInput';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

export const MedicationSelectInput: React.FC<Props> = ({ name, label, required }) => {
  const { data: medications, isLoading } = useGetMedicationList();
  const options = Object.entries(medications || {}).map(([value, label]) => {
    return {
      value,
      label,
    };
  });
  return <AutocompleteInput name={name} label={label} options={options} loading={isLoading} required={required} />;
};
