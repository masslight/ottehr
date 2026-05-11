import { Autocomplete, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useGetCreateExternalLabResources } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import {
  LabSetDTO,
  LabType,
  ModifiedOrderingLocation,
  nameLabTest,
  OrderableItemSearchResult,
  refineLabResponseForGenericLabSets,
  STATIC_COMPENDIUM_LAB_GUID,
} from 'utils';
import { safelyCaptureMessage } from 'utils/lib/frontend/sentry';
import { LabSets } from './LabSets';

type LabsAutocompleteProps = {
  selectedLabs: OrderableItemSearchResult[];
  orderingLocation:
    | {
        searchingForAll: true;
      }
    | {
        searchingForAll: false;
        selectedOrderingLocationId: string;
      };
  labOrgIdsString: string;
  setSelectedLabs: React.Dispatch<React.SetStateAction<OrderableItemSearchResult[]>>;
  labSets: LabSetDTO[] | undefined;
};

export const LabsAutocomplete: FC<LabsAutocompleteProps> = (props) => {
  const { selectedLabs, setSelectedLabs, labOrgIdsString, labSets, orderingLocation } = props;
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

  // coming back from the hook, we expect all these locations to have labGuids in their enabledLabs details
  const orderingLocations = data?.orderingLocations || [];

  const labs = expandResultsForGeneric(data?.labs || [], orderingLocations, orderingLocation);

  const { debounce } = useDebounce(800);
  const debouncedHandleLabInputChange = (searchValue: string): void => {
    debounce(() => {
      setDebouncedLabSearchTerm(searchValue);
    });
  };

  if (resourceFetchError) console.log('resourceFetchError', resourceFetchError);

  const handleSetSelectedLabsViaLabSets = async (labSet: LabSetDTO): Promise<void> => {
    if (labSet.listType === LabType.external) {
      const res = await apiClient?.getCreateExternalLabResources({
        selectedLabSet: labSet,
      });
      const labs = res?.labs;

      const genericLabsIncluded = new Set(labSet.labs.filter((lab) => lab.labGuid === STATIC_COMPENDIUM_LAB_GUID));

      if (labs) {
        setSelectedLabs((currentLabs) => {
          const existingCodes = new Set(
            currentLabs.map((lab) => `${lab.item.itemCode}${lab.lab.labGuid}${lab.lab.labName}`)
          );

          if (genericLabsIncluded.size > 0) {
            const refinedLabs = refineLabResponseForGenericLabSets(labs, genericLabsIncluded);
            const newLabs = refinedLabs.filter(
              (lab) => !existingCodes.has(`${lab.item.itemCode}${lab.lab.labGuid}${lab.lab.labName}`)
            );

            return [...currentLabs, ...newLabs];
          } else {
            const newLabs = labs.filter(
              (lab) => !existingCodes.has(`${lab.item.itemCode}${lab.lab.labGuid}${lab.lab.labName}`)
            );

            return [...currentLabs, ...newLabs];
          }
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
        getOptionKey={(lab) => `${lab.item.uniqueName}${lab.lab.labName}`}
        noOptionsText={
          debouncedLabSearchTerm && labs.length === 0 ? 'No labs based on input' : 'Start typing to load labs'
        }
        value={null}
        onChange={(_, selectedLab: any) => {
          const alreadySelected = selectedLabs.find((tempLab) => {
            const selectedUniqueNameWithLab = `${selectedLab.item.uniqueName}${selectedLab.lab.labName}`;
            const tempLabUniqueNameWithLab = `${tempLab.item.uniqueName}${tempLab.lab.labName}`;
            return tempLabUniqueNameWithLab === selectedUniqueNameWithLab;
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
            inputProps={{
              ...params.inputProps,
              'data-testid': dataTestIds.externalLabs.createPg.labsSearchAutoComplete,
            }}
          />
        )}
      />

      {labSets && <LabSets labSets={labSets} setSelectedLabs={handleSetSelectedLabsViaLabSets} />}
    </>
  );
};

const expandResultsForGeneric = (
  labs: OrderableItemSearchResult[],
  orderingLocations: ModifiedOrderingLocation[],
  orderingLocation: LabsAutocompleteProps['orderingLocation']
): OrderableItemSearchResult[] => {
  if (!orderingLocation || orderingLocations.length === 0) return [];

  const selectedLocation = orderingLocation.searchingForAll
    ? orderingLocations
    : orderingLocations.filter((location) => location.id === orderingLocation.selectedOrderingLocationId);

  if (!selectedLocation || selectedLocation.length === 0) {
    console.error('Unable to expand results, returning original labs results');
    safelyCaptureMessage(
      `Unexpected undefined selectedLocation for orderingLocation ${orderingLocation} when trying to expandResultsForGeneric`,
      { level: 'warning' }
    );
    return labs;
  }

  // find all the enabled labs that are using the generic compendium
  // sort by the lab name to keep the results sane
  const genericCompendiumLabDetails: {
    accountNumber: string;
    labOrgRef: string;
    labGuid: string;
    labName: string;
  }[] = [];

  for (const loc of selectedLocation) {
    const genericDetail = loc.enabledLabs
      .map((lab) => {
        if (lab.labGuid === STATIC_COMPENDIUM_LAB_GUID && lab.labName) return lab;
        return undefined;
      })
      .filter(
        (
          lab
        ): lab is {
          accountNumber: string;
          labOrgRef: string;
          labGuid: string;
          labName: string;
        } => lab !== undefined
      )
      .sort((a, b) => {
        const nameA = a.labName.toLowerCase();
        const nameB = b.labName.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

    genericCompendiumLabDetails.push(...genericDetail);
  }

  if (!genericCompendiumLabDetails.length) {
    console.log('No generic labs configured for this location, returning original list', orderingLocation);
    return labs;
  }

  const expandedResults: OrderableItemSearchResult[] = [];
  // go through each of the orderable item results, and any time you find an item using a generic compendium, expand it
  labs.forEach((orderableItem) => {
    if (orderableItem.lab.labGuid !== STATIC_COMPENDIUM_LAB_GUID) {
      expandedResults.push(orderableItem);
      return;
    }

    genericCompendiumLabDetails.forEach((genericLab) => {
      const editedOrderableItem: OrderableItemSearchResult = {
        ...orderableItem,
        lab: {
          ...orderableItem.lab,
          labName: genericLab.labName,
        },
      };
      expandedResults.push(editedOrderableItem);
    });
  });

  console.log('Expanded result count vs original result', expandedResults.length, labs.length);

  return expandedResults;
};
