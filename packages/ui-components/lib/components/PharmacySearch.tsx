import SearchIcon from '@mui/icons-material/Search';
import { Autocomplete, Box, debounce, InputAdornment, ListItem, Skeleton, TextField, Typography } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { PharmacyCollectionAnswerSetInput, PlacesResult, SearchPlacesInput, SearchPlacesOutput } from 'utils';

interface PharmacySearchProps {
  handlePharmacySelection: (input: PharmacyCollectionAnswerSetInput) => void;
  searchPlaces: (input: SearchPlacesInput) => Promise<SearchPlacesOutput>;
  dataTestId: string;
}

export const PharmacySearch: FC<PharmacySearchProps> = ({ handlePharmacySelection, searchPlaces, dataTestId }) => {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<PlacesResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();

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

    const handleSearchPlaces = async (): Promise<void> => {
      try {
        setSearching(true);
        const searchResponse = await searchPlaces({ searchTerm: debouncedSearchTerm });
        setResults(searchResponse.pharmacyPlaces);
      } catch (e) {
        console.log('error calling searchPlaces with searchTerm', e);
        setError('There was an error searching for the location');
        setOpen(false);
      } finally {
        setSearching(false);
      }
    };

    void handleSearchPlaces();
  }, [debouncedSearchTerm, searchPlaces]);

  const handlePharmSelect = async (placesId: string | undefined): Promise<void> => {
    if (!placesId) return;

    try {
      setLoading(true);

      const searchResponse = await searchPlaces({ placesId });
      const place = searchResponse.pharmacyPlaces?.[0];

      const pharmacyInput = {
        placesId: place.placesId,
        placesName: place.name,
        placesAddress: place.address,
        erxPharmacyId: place.erxPharmacyId,
      };

      handlePharmacySelection(pharmacyInput);
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
      data-testid={dataTestId}
      size="small"
      fullWidth
      popupIcon={null}
      noOptionsText={
        debouncedSearchTerm && results.length === 0 ? 'No results' : 'Please enter pharmacy name and address'
      }
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
