import { Close, Search } from '@mui/icons-material';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { ChangeEvent, Dispatch, ReactElement, SetStateAction } from 'react';

interface PatientSearchProps {
  nameFilter: string | null;
  setNameFilter: Dispatch<SetStateAction<string | null>>;
  onClear?: () => void;
}

export default function PatientSearch({ nameFilter, setNameFilter, onClear }: PatientSearchProps): ReactElement {
  return (
    <TextField
      id="patient-name"
      label="Name"
      placeholder="Search patients by name (Last, First)"
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            {nameFilter && nameFilter?.length > 0 ? (
              <IconButton
                aria-label="clear patient search"
                onClick={() => {
                  onClear && onClear();
                  setNameFilter(null);
                }}
                onMouseDown={(event) => event.preventDefault()}
                sx={{ p: 0 }}
              >
                <Close />
              </IconButton>
            ) : (
              <Search />
            )}
          </InputAdornment>
        ),
      }}
      InputLabelProps={{ shrink: true }}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        setNameFilter(event.target.value);
      }}
      sx={{ mr: 2, mb: 2 }}
      fullWidth
      value={nameFilter ?? ''}
    />
  );
}
