import SearchIcon from '@mui/icons-material/Search';
import { Autocomplete, Box, debounce, InputAdornment, ListItem, Skeleton, TextField, Typography } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import api from 'src/api/ottehrApi';
import { useUCZambdaClient } from 'src/hooks/useUCZambdaClient';
import { PlacesResult } from 'utils';
import { makePharmacyCollectionAnswerSet } from './helpers';

interface PharmacySearchProps {
  onChange: (e: any) => void;
  setSelectedPlace: (place: PlacesResult | null) => void;
}

export const PharmacySearch: FC<PharmacySearchProps> = ({ onChange, setSelectedPlace }) => {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<PlacesResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearchTerm(value);
      }, 300),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSetSearchTerm.clear();
    };
  }, [debouncedSetSearchTerm]);

  useEffect(() => {
    if (debouncedSearchTerm.length < 3) {
      setResults([]);
      return;
    }

    if (!zambdaClient) return;

    const searchPlaces = async (): Promise<void> => {
      try {
        setSearching(true);
        const searchResponse = await api.searchPlaces({ searchTerm: debouncedSearchTerm }, zambdaClient);
        setResults(searchResponse.pharmacyPlaces);
      } catch (e) {
        console.log('error calling searchPlaces with searchTerm', e);
        setError('There was an error searching for the location');
        setOpen(false);
      } finally {
        setSearching(false);
      }
    };

    void searchPlaces();
  }, [debouncedSearchTerm, zambdaClient]);

  const handlePharmSelect = async (placesId: string | undefined): Promise<void> => {
    if (!placesId || !zambdaClient) return;

    try {
      setLoading(true);

      const searchResponse = await api.searchPlaces({ placesId }, zambdaClient);
      const place = searchResponse.pharmacyPlaces?.[0];

      const answerSet = makePharmacyCollectionAnswerSet({
        placesId: place.placesId,
        placesName: place.name,
        placesAddress: place.address,
        erxPharmacyId: place.erxPharmacyId,
      });

      onChange(answerSet);
      setSelectedPlace(place);
    } catch (e) {
      console.log('error calling searchPlaces with placesId', e);
      setError('There was an error selecting the location');
    } finally {
      setLoading(false);
    }
  };

  return loading ? (
    <Skeleton variant="rectangular" height={40} width="100%" sx={{ borderRadius: 1 }} />
  ) : (
    <Autocomplete
      blurOnSelect
      size="small"
      fullWidth
      popupIcon={null}
      noOptionsText={debouncedSearchTerm && results.length === 0 ? 'No results' : 'Please enter search criteria'}
      options={results}
      value={null}
      inputValue={inputValue}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onInputChange={(_, newInputValue, reason) => {
        setInputValue(newInputValue);
        debouncedSetSearchTerm(newInputValue);
        if (reason === 'input' && error) setError(undefined);
      }}
      isOptionEqualToValue={(option, value) => value.placesId === option.placesId}
      onChange={(_, value) => {
        void handlePharmSelect(value?.placesId);
      }}
      getOptionLabel={(option) => (option ? `${option.name}${option.address ? ` ${option.address}` : ''}` : '')}
      loading={searching}
      renderOption={(props, option) => (
        <ListItem {...props} key={option.placesId}>
          <Box style={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body1">{option.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {option.address}
            </Typography>
          </Box>
        </ListItem>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search"
          error={Boolean(error)}
          helperText={error}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0 }}>
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}
    />
  );
};
