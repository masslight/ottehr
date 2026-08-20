import AddIcon from '@mui/icons-material/Add';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { FC, useState } from 'react';
import { GROUPED_FIELD_TEMPLATES, GroupedFieldTemplate } from '../groupedFieldTemplates';
import { ItemAction } from '../questionnaire.reducer';

interface AddFieldControlProps {
  pageKey: string;
  dispatch: React.Dispatch<ItemAction>;
}

export const AddFieldControl: FC<AddFieldControlProps> = ({ pageKey, dispatch }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const addGrouped = (template: GroupedFieldTemplate): void => {
    dispatch({ type: 'ADD_GROUPED_FIELD', key: pageKey, items: template.items });
    setDialogOpen(false);
  };

  return (
    <>
      <Tooltip title="Add field">
        <IconButton size="small" color="primary" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            dispatch({ type: 'ADD_CHILD_ITEM', key: pageKey });
            setMenuAnchor(null);
          }}
        >
          Basic field
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDialogOpen(true);
            setMenuAnchor(null);
          }}
        >
          Grouped field…
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add a grouped field</DialogTitle>
        <DialogContent dividers>
          {GROUPED_FIELD_TEMPLATES.map((template) => (
            <ListItemButton key={template.id} onClick={() => addGrouped(template)}>
              <ListItemText primary={template.label} secondary={template.description} />
            </ListItemButton>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
};
