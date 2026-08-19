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
  Typography,
} from '@mui/material';
import { FC, useState } from 'react';
import { DEVELOPED_FIELD_TEMPLATES, DevelopedFieldTemplate } from '../developedFieldTemplates';
import { ItemAction } from '../questionnaire.reducer';

interface AddFieldControlProps {
  pageKey: string;
  dispatch: React.Dispatch<ItemAction>;
  // linkIds already present in the form; a developed field whose reserved linkIds collide is single-use-blocked
  usedLinkIds: ReadonlySet<string>;
}

export const AddFieldControl: FC<AddFieldControlProps> = ({ pageKey, dispatch, usedLinkIds }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isAlreadyUsed = (template: DevelopedFieldTemplate): boolean =>
    template.reservedLinkIds.some((linkId) => usedLinkIds.has(linkId));

  const addDeveloped = (template: DevelopedFieldTemplate): void => {
    dispatch({ type: 'ADD_DEVELOPED_FIELD', key: pageKey, items: template.items });
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
          Developed field…
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add a developed field</DialogTitle>
        <DialogContent dividers>
          {DEVELOPED_FIELD_TEMPLATES.map((template) => {
            const used = isAlreadyUsed(template);
            return (
              <ListItemButton key={template.id} disabled={used} onClick={() => addDeveloped(template)}>
                <ListItemText
                  primary={template.label}
                  secondary={used ? 'Already added to this form' : template.description}
                />
              </ListItemButton>
            );
          })}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Developed fields are pre-built widgets with reserved question ids and can be added once per form.
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
};
