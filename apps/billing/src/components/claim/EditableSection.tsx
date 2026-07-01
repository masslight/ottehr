import { Edit as EditIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Collapse, Typography } from '@mui/material';
import { FC, ReactNode, useState } from 'react';

interface EditableSectionProps {
  title: string;
  children: ReactNode;
  editForm?: ReactNode;
  onSave?: () => Promise<string | null>;
  onCancel?: () => void;
}

export const EditableSection: FC<EditableSectionProps> = ({ title, children, editForm, onSave, onCancel }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    if (!onSave) return;
    setError(null);
    setSaving(true);
    try {
      const result = await onSave();
      if (result) {
        setError(result);
      } else {
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (): void => {
    setEditing(false);
    setError(null);
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
              <Button size="small" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
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
          <Box sx={{ mt: 2 }}>{editForm}</Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};
