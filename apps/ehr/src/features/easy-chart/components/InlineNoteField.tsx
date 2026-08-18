// Every free-text section of the note is directly editable by typing, exactly like a normal document.
// The assistant is never the only way in.
//
// Hand-editing a field CLEARS its AI-authorship mark: the note must reflect who really wrote what,
// and leaving the mark would attribute the provider's own words to the assistant.

import { TextField, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';

export interface InlineNoteFieldProps {
  label: string;
  value: string | undefined;
  onSave: (text: string) => void | Promise<void>;
  /** Called the moment the provider starts editing, so the AI mark drops immediately. */
  onEditStart?: () => void;
  disabled?: boolean;
  placeholder?: string;
  dataTestId?: string;
}

export const InlineNoteField: FC<InlineNoteFieldProps> = ({
  label,
  value,
  onSave,
  onEditStart,
  disabled,
  placeholder,
  dataTestId,
}) => {
  const [draft, setDraft] = useState(value ?? '');
  const [dirty, setDirty] = useState(false);

  // Adopt an assistant-written value, but never clobber what the provider is part-way through typing.
  useEffect(() => {
    if (!dirty) setDraft(value ?? '');
  }, [value, dirty]);

  return (
    <div>
      <Typography variant="subtitle2" color="primary.dark" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <TextField
        multiline
        fullWidth
        minRows={2}
        size="small"
        value={draft}
        disabled={disabled}
        placeholder={placeholder ?? `Type or dictate the ${label.toLowerCase()}…`}
        data-testid={dataTestId}
        onChange={(event) => {
          if (!dirty) onEditStart?.();
          setDirty(true);
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (!dirty) return;
          setDirty(false);
          if ((value ?? '') !== draft) void onSave(draft);
        }}
      />
    </div>
  );
};
