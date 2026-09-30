import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, ListItemIcon, Menu, MenuItem, Paper, Tooltip, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { QuestionnaireResponseViewer } from './QuestionnaireResponseViewer';

const MENU_ITEM_SX = { color: 'primary.main', fontWeight: 500 };
const DESTRUCTIVE_MENU_ITEM_SX = { color: 'error.main', fontWeight: 500 };
const MENU_ITEM_ICON_SX = { color: 'inherit' };

const SHARED_RESPONSE_TOOLTIP =
  "This form was part of the visit's intake paperwork, so its answers share one response with the rest of that paperwork and cannot be deleted on their own.";

interface CustomFormCardProps {
  form: StandaloneFormDTO;
  deletable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const CustomFormCard: FC<CustomFormCardProps> = ({ form, deletable, onEdit, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  const closeMenu = (): void => setAnchorEl(null);

  return (
    <Paper sx={{ mt: 2, p: 3 }} data-testid={dataTestIds.visitDetailsPage.customFormCard(form.questionnaireId)}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F347C' }}>
          {form.questionnaireTitle}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Actions for ${form.questionnaireTitle}`}
          aria-haspopup="true"
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          data-testid={dataTestIds.visitDetailsPage.customFormMenuButton(form.questionnaireId)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          data-testid={dataTestIds.visitDetailsPage.customFormEditMenuItem}
          onClick={() => {
            closeMenu();
            onEdit();
          }}
          sx={MENU_ITEM_SX}
        >
          <ListItemIcon sx={MENU_ITEM_ICON_SX}>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        {deletable ? (
          <MenuItem
            data-testid={dataTestIds.visitDetailsPage.customFormDeleteMenuItem}
            onClick={() => {
              closeMenu();
              onDelete();
            }}
            sx={DESTRUCTIVE_MENU_ITEM_SX}
          >
            <ListItemIcon sx={MENU_ITEM_ICON_SX}>
              <DeleteOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Delete
          </MenuItem>
        ) : (
          <Tooltip title={SHARED_RESPONSE_TOOLTIP} placement="left">
            <Box component="span">
              <MenuItem disabled sx={DESTRUCTIVE_MENU_ITEM_SX}>
                <ListItemIcon sx={MENU_ITEM_ICON_SX}>
                  <DeleteOutlinedIcon fontSize="small" />
                </ListItemIcon>
                Delete
              </MenuItem>
            </Box>
          </Tooltip>
        )}
      </Menu>
      <QuestionnaireResponseViewer form={form} />
    </Paper>
  );
};
