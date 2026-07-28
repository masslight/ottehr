import CloseIcon from '@mui/icons-material/Close';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import { Box, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { FlowForm } from 'utils';

interface OrderedFormEditorProps {
  formsSelected: FlowForm[];
  formOptions: FlowForm[];
  onChange: (next: FlowForm[]) => void;
}

export const OrderedFormEditor: FC<OrderedFormEditorProps> = ({ formsSelected, formOptions, onChange }) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const available = formOptions.filter((f) => !formsSelected.some((form) => form.id === f.id));

  const reorder = (from: number, to: number): void => {
    if (from === to) return;
    const next = [...formsSelected];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        {formsSelected.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            No forms attached.
          </Typography>
        ) : (
          formsSelected.map((form, i) => (
            <Stack
              key={form.id}
              direction="row"
              alignItems="center"
              spacing={0.5}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, i);
                setDragIndex(null);
              }}
              sx={{ opacity: dragIndex === i ? 0.5 : 1 }}
            >
              <Box
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled' }}
              >
                <DragHandleIcon fontSize="small" />
              </Box>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {form.label}
              </Typography>
              <IconButton size="small" onClick={() => onChange(formsSelected.filter((f) => f.id !== form.id))}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))
        )}
      </Stack>
      <FormControl fullWidth size="small">
        <InputLabel id="add-flow-form">Add form</InputLabel>
        <Select
          labelId="add-flow-form"
          label="Add form"
          value=""
          onChange={(e) => {
            const id = e.target.value as string;
            const option = formOptions.find((o) => o.id === id);
            console.log('im changing!', id, option);
            if (option && !formsSelected.some((f) => f.id === id)) onChange([...formsSelected, option]);
          }}
        >
          {available.length === 0 && <MenuItem disabled>All forms added</MenuItem>}
          {available.map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );
};
