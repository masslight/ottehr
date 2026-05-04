import { Stack } from '@mui/system';
import { ExternalSelectedTests } from 'src/features/external-labs/components/create/ExternalSelectedTests';
import { LabsAutocomplete } from 'src/features/external-labs/components/LabsAutocomplete';
import { useGetCreateExternalLabResources } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { OrderableItemSearchResult } from 'utils';

interface AdminLabSetExternalSelectionProps {
  selectedLabs: OrderableItemSearchResult[];
  setSelectedLabs: React.Dispatch<React.SetStateAction<OrderableItemSearchResult[]>>;
}

export const AdminLabSetExternalSelection: React.FC<AdminLabSetExternalSelectionProps> = ({
  selectedLabs,
  setSelectedLabs,
}) => {
  const { data } = useGetCreateExternalLabResources({});

  const orderingLocationIds =
    data?.orderingLocations?.flatMap((loc) =>
      loc.enabledLabs.map((lab) => lab.labOrgRef.replace('Organization/', ''))
    ) ?? [];

  return (
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
  );
};
