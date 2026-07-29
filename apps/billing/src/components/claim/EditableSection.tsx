import { Edit as EditIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Collapse, Typography } from '@mui/material';
import { ReactElement, ReactNode, useEffect, useState } from 'react';
import { DefaultValues, FieldValues, FormProvider, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { getApiError } from 'utils';

interface EditableSectionProps<T> {
  title: string | ReactElement;
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

  useEffect(() => {
    reset(defaultValues);
  }, [reset, defaultValues]);

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
    reset(defaultValues);
    onCancel?.();
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: editing ? 0 : 1.5 }}>
          {typeof title === 'string' ? (
            <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
              {title}
            </Typography>
          ) : (
            title
          )}
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
          {/* {defaultValues ? ( */}
          <FormProvider {...methods}>
            <Box sx={{ mt: 2 }}>{editForm}</Box>
          </FormProvider>
          {/* ) : ( */}
          {/* <></> */}
          {/* )} */}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export function EditableSectionSkeleton({ title }: { title: string }): ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
            {title}
          </Typography>
          <Button size="small" startIcon={<EditIcon fontSize="small" />} disabled={true}>
            Edit
          </Button>
        </Box>
        <Collapse in={true}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <CircularProgress />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export function TitleWithSourceLink({
  title,
  sourceId,
  sourceRouteBase,
}: {
  title: string;
  sourceId?: string;
  sourceRouteBase?: string;
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
      <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
        {title}
      </Typography>
      {sourceId ? (
        <Link to={`${sourceRouteBase}${sourceId}`}>
          <Typography variant="caption" ml={1}>
            Go to source
          </Typography>
        </Link>
      ) : (
        <></>
      )}
    </Box>
  );
}
