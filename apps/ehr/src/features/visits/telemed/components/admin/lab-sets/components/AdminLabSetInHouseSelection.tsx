import { Stack } from '@mui/system';
import { useEffect, useRef, useState } from 'react';
import { InHouseLabSelect } from 'src/features/in-house-labs/components/create/InHouseLabSelect';
import { InHouseSelectedTestTable } from 'src/features/in-house-labs/components/create/InHouseSelectedTestTable';
import { useGetCreateInHouseLabResources } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { DataEntryTestItem, InHouseLabSetDTO } from 'utils';

interface AdminLabSetInHouseSelectionProps {
  onTestsChange: (tests: DataEntryTestItem[]) => void;
  defaultLabs?: InHouseLabSetDTO['labs'];
}

export const AdminLabSetInHouseSelection: React.FC<AdminLabSetInHouseSelectionProps> = ({
  onTestsChange,
  defaultLabs,
}) => {
  const { data: createInHouseLabResources } = useGetCreateInHouseLabResources({});
  const availableTests = Object.values(createInHouseLabResources?.labs || {});

  const [selectedTests, setSelectedTests] = useState<DataEntryTestItem[]>([]);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!defaultLabs?.length || !availableTests?.length) return;

    const preSelected = defaultLabs
      .map((lab) => {
        const matchByAdUrl = lab.adUrl ? availableTests.find((t) => t.adUrl === lab.adUrl) : undefined;
        return matchByAdUrl ?? availableTests.find((t) => t.name === lab.display);
      })
      .filter(Boolean) as DataEntryTestItem[];

    setSelectedTests(preSelected);
    hasInitializedRef.current = true;
  }, [defaultLabs, availableTests]);

  useEffect(() => {
    onTestsChange(selectedTests);
  }, [selectedTests, onTestsChange]);

  const handleTestSelectionChange = (newSelectedNames: string[]): void => {
    if (!availableTests?.length) {
      return;
    }

    setSelectedTests((currentTests) => {
      const testsToAdd = newSelectedNames
        .filter((name) => !currentTests.some((test) => test.name === name))
        .map((name) => availableTests.find((test) => test.name === name))
        .filter((test): test is DataEntryTestItem => test !== undefined);

      const testsAfterRemovals = currentTests.filter((test) => {
        const isAvailableTest = availableTests.some((availableTest) => availableTest.name === test.name);
        return !isAvailableTest || newSelectedNames.includes(test.name);
      });

      return [...testsAfterRemovals, ...testsToAdd];
    });
  };

  return (
    <Stack spacing={2}>
      <InHouseLabSelect
        availableTests={availableTests}
        selectedTestNames={selectedTests.map((t) => t.name)}
        onChange={handleTestSelectionChange}
      />
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
