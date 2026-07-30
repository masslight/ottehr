import { Autocomplete, AutocompleteRenderInputParams, Box, TextField, Typography } from '@mui/material';
import { HTMLAttributes, ReactElement, ReactNode, Ref, useState } from 'react';
import { HOLD_TAG_NAME } from 'utils';
import { searchBillingTags } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

// Tag picker for the rules builder: only tags that exist in the tags feature can be chosen (no free
// text), matching save-billing-rules' server-side check. The tag list is small and loads once on
// first open (the Tags page precedent) with MUI's client-side filtering. The Hold tag is always
// offered even before it has been seeded as a stored tag (it is built into the engine), and a
// stored-but-deleted tag stays visible so an existing rule renders faithfully — the server rejects
// it with a clear message on the next save.

interface TagOption {
  name: string;
  description: string;
}

interface TagSelectProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  // react-hook-form field ref, so shouldFocusError can focus this input on a failed submit.
  inputRef?: Ref<HTMLInputElement>;
}

const HOLD_FALLBACK_OPTION: TagOption = { name: HOLD_TAG_NAME, description: 'Holds the claim and stops the engine.' };

export function TagSelect({
  value,
  onChange,
  label = 'Tag',
  required,
  error,
  helperText,
  inputRef,
}: TagSelectProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [fetched, setFetched] = useState<TagOption[] | undefined>(undefined);

  const load = async (): Promise<void> => {
    if (fetched || !oystehrZambda) return;
    try {
      const res = await searchBillingTags(oystehrZambda);
      setFetched((res.tags ?? []).map((tag) => ({ name: tag.name, description: tag.description })));
    } catch {
      setFetched([]);
    }
  };

  // Fetched tags win the dedupe (a seeded Hold tag carries its real description); the stored value
  // is appended last so it renders even when its definition has been deleted.
  const stored = value?.trim();
  const seen = new Set<string>();
  const options = [
    ...(fetched ?? []),
    HOLD_FALLBACK_OPTION,
    ...(stored ? [{ name: stored, description: '' }] : []),
  ].filter((option) => {
    if (seen.has(option.name)) return false;
    seen.add(option.name);
    return true;
  });

  const selected = stored ? options.find((option) => option.name === stored) ?? null : null;

  return (
    <Autocomplete<TagOption, false, false, false>
      size="small"
      options={options}
      value={selected}
      onOpen={() => void load()}
      onChange={(_, option) => onChange(option?.name ?? '')}
      isOptionEqualToValue={(option, v) => option.name === v.name}
      getOptionLabel={(option) => option.name}
      renderOption={(props: HTMLAttributes<HTMLLIElement>, option) => (
        <li {...props} key={option.name}>
          <Box>
            <Typography variant="body2">{option.name}</Typography>
            {option.description && (
              <Typography variant="caption" color="text.secondary" display="block">
                {option.description}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderInput={(params: AutocompleteRenderInputParams) => (
        <TextField
          {...params}
          label={label}
          placeholder="Select a tag…"
          required={required}
          error={error}
          helperText={helperText}
          inputRef={inputRef}
        />
      )}
      sx={{ minWidth: 240 }}
    />
  );
}
