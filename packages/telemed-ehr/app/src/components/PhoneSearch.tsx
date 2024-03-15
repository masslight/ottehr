import { Close, Search } from '@mui/icons-material';
import { InputAdornment, IconButton, OutlinedInput, FormControl, InputLabel, FormHelperText } from '@mui/material';
import { Dispatch, ReactElement, SetStateAction, useState } from 'react';
import InputMask from './InputMask';

interface PhoneSearchProps {
  phoneFilter: string | null;
  setPhoneFilter: Dispatch<SetStateAction<string | null>>;
  onClear?: () => void;
}

export default function PhoneSearch({ phoneFilter, setPhoneFilter, onClear }: PhoneSearchProps): ReactElement {
  const [error, setError] = useState<boolean>(false);
  return (
    <FormControl variant="outlined" fullWidth>
      <InputLabel shrink error={error}>
        Phone
      </InputLabel>
      <OutlinedInput
        id="phone"
        label="Phone"
        type="tel"
        placeholder="Search patients by phone"
        value={phoneFilter ?? ''}
        inputMode="numeric"
        inputComponent={InputMask as any}
        inputProps={{
          mask: '(000) 000-0000',
        }}
        endAdornment={
          <InputAdornment position="end">
            {phoneFilter && phoneFilter?.length > 0 ? (
              <IconButton
                aria-label="clear phone search"
                onClick={() => {
                  onClear && onClear();
                  setPhoneFilter(null);
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
        }
        onChange={(e) => {
          const phone = e.target.value.replace(/\D/g, '');
          setPhoneFilter(phone);
          phone.length && phone.length < 10 ? setError(true) : setError(false);
        }}
        error={error}
        notched
      />
      <FormHelperText error sx={{ visibility: error ? 'visible' : 'hidden' }}>
        Phone number must be 10 digits
      </FormHelperText>
    </FormControl>
  );
}
