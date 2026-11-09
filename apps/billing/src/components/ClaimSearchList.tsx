import {
  Alert,
  Box,
  CircularProgress,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
} from '@mui/material';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingClaimItem } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingClaims } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

interface ClaimSearchListProps {
  selectedId: string | null;
  onSelect: (claim: BillingClaimItem | null) => void;
  // claims shown but not selectable, with the reason (e.g. already on this remit)
  unavailable?: Map<string, string>;
}

// Find a claim by patient name or claim ID and pick one — used to match a remit claim to a claim and
// to associate a claim when keying in a remit.
export function ClaimSearchList({ selectedId, onSelect, unavailable }: ClaimSearchListProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { clear, debounce } = useDebounce();
  const [searchText, setSearchText] = useState('');
  const [claims, setClaims] = useState<BillingClaimItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // answers to superseded searches are dropped
  const searchRequest = useRef(0);

  useEffect(
    () => () => {
      searchRequest.current += 1;
    },
    []
  );

  const search = (text: string): void => {
    setSearchText(text);
    const request = ++searchRequest.current;
    setClaims([]);
    onSelect(null);
    setError(null);
    setLoading(false);
    if (!text) {
      clear();
      return;
    }
    debounce(async () => {
      if (!oystehrZambda) return;
      try {
        setLoading(true);
        const data = await searchBillingClaims(oystehrZambda, {
          searchText: text,
          pageSize: 25,
          patientNameOnly: true,
        });
        if (request !== searchRequest.current) return;
        setClaims(data.claims);
        if (data.claims.length === 0) setError('Claim not found');
      } catch (err) {
        if (request !== searchRequest.current) return;
        setClaims([]);
        setError(getApiError({ error: err, defaultError: 'Failed to search claims' }));
      } finally {
        if (request === searchRequest.current) setLoading(false);
      }
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <TextField
        size="small"
        fullWidth
        autoFocus
        label="Patient name or claim ID"
        value={searchText}
        onChange={(e) => search(e.target.value)}
        helperText="Patient names match from the start. Claim IDs must be entered in full."
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {loading ? <CircularProgress sx={{ color: 'text.secondary' }} size={18} /> : null}
            </InputAdornment>
          ),
        }}
      />
      {claims.length > 0 && (
        <List disablePadding sx={{ maxHeight: 240, overflowY: 'auto', border: 1, borderColor: 'divider' }}>
          {claims.map((option) => {
            const reason = unavailable?.get(option.id);
            return (
              <ListItemButton
                key={option.id}
                selected={selectedId === option.id}
                disabled={!!reason}
                onClick={() => onSelect(option)}
              >
                <ListItemText
                  primary={option.patientName}
                  secondary={[
                    `DOB ${option.patientDob || '—'} · DOS ${option.serviceDate || '—'} · Claim ID ${option.id}`,
                    reason,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  primaryTypographyProps={{ fontWeight: 600 }}
                  secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
}
