import { FC, useState, useMemo, useEffect } from 'react';
import { OrderableItemSearchResult } from 'utils';
import { Autocomplete, TextField, Box, Skeleton } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import { useApiClients } from '../../../hooks/useAppClients';
import { Organization } from 'fhir/r4b';
import Oystehr from '@oystehr/sdk';

type LabsAutocompleteProps = {
  selectedLab: OrderableItemSearchResult | null;
  setSelectedLab: React.Dispatch<React.SetStateAction<OrderableItemSearchResult | null>>;
};

export const LabsAutocomplete: FC<LabsAutocompleteProps> = (props) => {
  const { selectedLab, setSelectedLab } = props;
  const { getAccessTokenSilently } = useAuth0();
  const { oystehr } = useApiClients();

  const [loading, setLoading] = useState<boolean>(true);
  const [labs, setLabs] = useState<OrderableItemSearchResult[]>([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    async function getLabs(oystehr: Oystehr): Promise<void> {
      if (!oystehr) {
        return;
      }

      setLoading(true);

      const labOrgsGuids: string[] = [];

      try {
        const organizationSearch = (
          await oystehr.fhir.search<Organization>({
            resourceType: 'Organization',
            params: [{ name: 'type', value: 'http://snomed.info/sct|261904005' }], // todo add consts for these values
          })
        ).unbundle();
        console.log('organizationSearch', organizationSearch);
        organizationSearch.forEach((org) => {
          const labGuid = org.identifier?.find((id) => id.system === 'https://identifiers.fhir.oystehr.com/lab-guid')
            ?.value; // todo add const for this system
          if (labGuid) labOrgsGuids.push(labGuid);
        });
      } catch (e) {
        console.error('error getting lab organizations', e);
      }

      if (labOrgsGuids) {
        try {
          const token = await getAccessTokenSilently();
          const projectId = import.meta.env.VITE_APP_PROJECT_ID;
          const orderableItemSearchUrl = 'https://labs-api.zapehr.com/v1/orderableItem'; // todo add const somewhere
          const labIds = labOrgsGuids.join(',');
          let cursor = '';
          const items: OrderableItemSearchResult[] = [];

          do {
            const url = `${orderableItemSearchUrl}?labIds=${labIds}&limit=100&cursor=${cursor}`;
            const orderableItemsSearch = await fetch(url, {
              method: 'GET',
              headers: {
                'x-zapehr-project-id': projectId,
                Authorization: `Bearer ${token}`,
              },
            });
            const response = await orderableItemsSearch.json();
            console.log('check the orderable item search res', response);
            const orabledItemsRes = response.orderableItems as OrderableItemSearchResult[];
            items.push(...orabledItemsRes);
            cursor = response?.metadata?.nextCursor || '';
          } while (cursor !== '');

          console.log('check orderableItems', items);
          setLabs(items);
        } catch (e) {
          console.error('error fetching orderable items', e);
        }
      }

      setLoading(false);
    }

    if (oystehr) {
      void getLabs(oystehr);
    }
  }, [oystehr, getAccessTokenSilently]);

  const filterOptions = useMemo(() => {
    if (inputValue === '') return [];
    return labs.filter((item) => {
      return item.item.itemName.toLowerCase().includes(inputValue.toLowerCase());
    });
  }, [inputValue, labs]);

  console.log('inputValue', inputValue);
  console.log('selectedLab', selectedLab);
  return (
    <Box sx={{ paddingTop: '8px' }}>
      {loading ? (
        <Skeleton height="40px"></Skeleton>
      ) : (
        <Autocomplete
          size="small"
          options={filterOptions}
          getOptionLabel={(option) => `${option.item.itemName} / ${option.lab.labName}`}
          noOptionsText={
            inputValue && filterOptions.length === 0 ? 'No labs based on input' : 'Start typing to load labs'
          }
          value={selectedLab}
          onChange={(_, newValue) => setSelectedLab(newValue)}
          inputValue={inputValue}
          onInputChange={(_, newValue) => setInputValue(newValue)}
          renderInput={(params) => <TextField {...params} label="Lab" variant="outlined" />}
        />
      )}
    </Box>
  );
};
