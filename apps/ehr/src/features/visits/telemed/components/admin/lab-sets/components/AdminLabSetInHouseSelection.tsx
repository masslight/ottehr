import { Stack } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import { InHouseLabSelect } from 'src/features/in-house-labs/components/create/InHouseLabSelect';
import { InHouseSelectedTestTable } from 'src/features/in-house-labs/components/create/InHouseSelectedTestTable';
import { useGetCreateInHouseLabResources } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { DataEntryTestItem } from 'utils';

interface AdminLabSetInHouseSelectionProps {
  selectedTests: DataEntryTestItem[];
  setSelectedTests: (value: React.SetStateAction<DataEntryTestItem[]>) => void;
}

export const AdminLabSetInHouseSelection: React.FC<AdminLabSetInHouseSelectionProps> = ({
  selectedTests,
  setSelectedTests,
}) => {
  const { data: createInHouseLabResources } = useGetCreateInHouseLabResources({});
  const availableTests = Object.values(createInHouseLabResources?.labs || {});

  const handleTestSelection = (selectedTest: string): void => {
    if (!availableTests?.length) {
      return;
    }

    const foundEntry = availableTests.find((test) => test.name === selectedTest);

    if (!foundEntry) {
      return;
    }

    const alreadySelected = selectedTests.find((tempLab) => {
      return tempLab.name === selectedTest;
    });

    if (!alreadySelected) {
      setSelectedTests([...selectedTests, foundEntry]);
    } else {
      enqueueSnackbar('This lab has already been selected', {
        variant: 'error',
      });
    }
  };

  return (
    <Stack spacing={2}>
      <InHouseLabSelect availableTests={availableTests} handleTestSelection={handleTestSelection} />
      {selectedTests.length > 0 && (
        <InHouseSelectedTestTable
          selectedTests={selectedTests}
          setSelectedTests={setSelectedTests}
          displayRunAsRepeat={false}
        />
      )}
    </Stack>
  );
};
