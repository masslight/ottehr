import { Autocomplete, Grid, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useGetCreateExternalLabResources } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { LabListsDTO, LabType, nameLabTest, OrderableItemSearchResult } from 'utils';
import { LabSets } from './LabSets';

type LabsAutocompleteProps = {
  selectedLabs: OrderableItemSearchResult[];
  labOrgIdsString: string;
  setSelectedLabs: React.Dispatch<React.SetStateAction<OrderableItemSearchResult[]>>;
  labSets: LabListsDTO[] | undefined;
};

export const LabsAutocomplete: FC<LabsAutocompleteProps> = (props) => {
  const { selectedLabs, setSelectedLabs, labOrgIdsString, labSets } = props;
  const [debouncedLabSearchTerm, setDebouncedLabSearchTerm] = useState<string | undefined>(undefined);
  const apiClient = useOystehrAPIClient();

  const {
    isFetching,
    data,
    isError,
    error: resourceFetchError,
  } = useGetCreateExternalLabResources({
    search: debouncedLabSearchTerm,
    labOrgIdsString,
  });

  const labs = data?.labs || [];

  const { debounce } = useDebounce(800);
  const debouncedHandleLabInputChange = (searchValue: string): void => {
    debounce(() => {
      setDebouncedLabSearchTerm(searchValue);
    });
  };

  if (resourceFetchError) console.log('resourceFetchError', resourceFetchError);

  const handleSetSelectedLabsViaLabSets = async (labSet: LabListsDTO): Promise<void> => {
    if (labSet.listType === LabType.external) {
      const res = await apiClient?.getCreateExternalLabResources({
        selectedLabSet: labSet,
      });
      const labs = res?.labs;

      if (labs) {
        setSelectedLabs((currentLabs) => {
          const existingCodes = new Set(currentLabs.map((lab) => `${lab.item.itemCode}${lab.lab.labGuid}`));

          const newLabs = labs.filter((lab) => !existingCodes.has(`${lab.item.itemCode}${lab.lab.labGuid}`));

          return [...currentLabs, ...newLabs];
        });
      }
    }
  };

  return (
    <>
      <Autocomplete
        blurOnSelect
        size="small"
        options={labs}
        getOptionLabel={(option) => nameLabTest(option.item.itemName, option.lab.labName, false)}
        getOptionKey={(lab) => lab.item.uniqueName}
        noOptionsText={
          debouncedLabSearchTerm && labs.length === 0 ? 'No labs based on input' : 'Start typing to load labs'
        }
        value={null}
        onChange={(_, selectedLab: any) => {
          const alreadySelected = selectedLabs.find((tempLab) => {
            return tempLab.item.uniqueName === selectedLab.item.uniqueName;
          });
          if (!alreadySelected) {
            setSelectedLabs([...selectedLabs, selectedLab]);
          } else {
            enqueueSnackbar('This lab is already added to the order', {
              variant: 'error',
            });
          }
        }}
        loading={isFetching}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Lab"
            variant="outlined"
            error={isError}
            helperText={isError ? 'Failed to load labs list' : ''}
            onChange={(e) => debouncedHandleLabInputChange(e.target.value)}
          />
        )}
      />

      {labSets && <LabSets labSets={labSets} setSelectedLabs={handleSetSelectedLabsViaLabSets} />}

      {selectedLabs.length > 0 && (
        <Grid container>
          <Grid item xs={12}>
            <ActionsList
              data={selectedLabs}
              getKey={(value, index) => `selected-lab-${index}-${value.item.itemCode}`}
              renderItem={(value) => (
                <Typography>{nameLabTest(value.item.itemName, value.lab.labName, false)}</Typography>
              )}
              renderActions={(lab) => (
                <DeleteIconButton
                  onClick={() =>
                    setSelectedLabs((prev) =>
                      prev.filter((tempLab) => {
                        return tempLab.item.uniqueName !== lab.item.uniqueName;
                      })
                    )
                  }
                />
              )}
            />
          </Grid>
        </Grid>
      )}
    </>
  );
};
