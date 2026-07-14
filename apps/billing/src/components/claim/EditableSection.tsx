import { Edit as EditIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Collapse, Typography } from '@mui/material';
import { ReactElement, ReactNode, useState } from 'react';
import { DefaultValues, FieldValues, FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils';

interface EditableSectionProps<T> {
  title: string;
  children: ReactNode;
  editForm?: ReactNode;
  defaultValues?: DefaultValues<T>;
  onSave: (data: T) => Promise<string | null> | Promise<void>;
  onCancel?: () => void;
}

export const EditableSection = <T extends FieldValues>({
  title,
  children,
  editForm,
  defaultValues,
  onSave,
  onCancel,
}: EditableSectionProps<T>): ReactElement => {
  const methods = useForm<T, unknown, T>({
    defaultValues,
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (data: T): Promise<void> => {
    setError(null);
    try {
      const result = await onSave(data);
      if (result) {
        setError(result);
      } else {
        setEditing(false);
      }
    } catch (err: unknown) {
      setError(getApiError({ error: err, defaultError: 'Failed to submit request' }));
    }
  };

  const handleCancel = (): void => {
    setEditing(false);
    setError(null);
    reset();
    onCancel?.();
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: editing ? 0 : 1.5 }}>
          <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
            {title}
          </Typography>
          {editForm && !editing && (
            <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {editing && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleSubmit(handleSave)} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          )}
        </Box>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <Collapse in={!editing}>{children}</Collapse>
        <Collapse in={editing}>
          <FormProvider {...methods}>
            <Box sx={{ mt: 2 }}>{editForm}</Box>
          </FormProvider>
        </Collapse>
      </CardContent>
    </Card>
  );
};
