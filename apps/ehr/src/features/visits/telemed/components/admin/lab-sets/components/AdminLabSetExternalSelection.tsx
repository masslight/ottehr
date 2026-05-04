import { CircularProgress } from '@mui/material';
import { Stack } from '@mui/system';
import { useEffect, useRef, useState } from 'react';
import { ExternalSelectedTests } from 'src/features/external-labs/components/create/ExternalSelectedTests';
import { LabsAutocomplete } from 'src/features/external-labs/components/LabsAutocomplete';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useGetCreateExternalLabResources } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { ExternalLabSetDTO, OrderableItemSearchResult } from 'utils';

interface AdminLabSetExternalSelectionProps {
  onTestsChange: (tests: OrderableItemSearchResult[]) => void;
  defaultLabs?: ExternalLabSetDTO;
}

export const AdminLabSetExternalSelection: React.FC<AdminLabSetExternalSelectionProps> = ({
  onTestsChange,
  defaultLabs,
}) => {
  console.log('defaultLabs', defaultLabs);

  const { data } = useGetCreateExternalLabResources({});
  const apiClient = useOystehrAPIClient();

  const orderingLocationIds =
    data?.orderingLocations?.flatMap((loc) =>
      loc.enabledLabs.map((lab) => lab.labOrgRef.replace('Organization/', ''))
    ) ?? [];

  const [selectedLabs, setSelectedLabs] = useState<OrderableItemSearchResult[]>([]);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!defaultLabs) {
      hasInitializedRef.current = true;
      return;
    }

    const fetchLabs = async (): Promise<void> => {
      const response = await apiClient?.getCreateExternalLabResources({
        selectedLabSet: defaultLabs,
      });

      if (response?.labs) {
        setSelectedLabs(response.labs);
        hasInitializedRef.current = true;
      }
    };

    void fetchLabs();
  }, [defaultLabs, apiClient]);

  useEffect(() => {
    onTestsChange(selectedLabs);
  }, [selectedLabs, onTestsChange]);

  return hasInitializedRef.current ? (
    <Stack spacing={2}>
      <LabsAutocomplete
        selectedOrderingLocationId={''}
        labOrgIdsString={orderingLocationIds.join(',')}
        selectedLabs={selectedLabs}
        setSelectedLabs={setSelectedLabs}
        labSets={undefined}
      ></LabsAutocomplete>
      <ExternalSelectedTests selectedLabs={selectedLabs} setSelectedLabs={setSelectedLabs} />
    </Stack>
  ) : (
    <CircularProgress />
  );
};
