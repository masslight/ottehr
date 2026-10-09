import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material';
import { FC, useState } from 'react';
import { Section } from 'src/components/layout/Section';
import { QuestionnaireResponseViewer } from 'src/components/QuestionnaireResponseViewer';
import { dataTestIds } from 'src/constants/data-test-ids';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

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
  const { questionnaireId, questionnaireTitle } = form;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);
  const closeMenu = (): void => setAnchorEl(null);

  const titleWidget = (
    <Box>
      <IconButton
        size="small"
        aria-label={`Actions for ${questionnaireTitle}`}
        aria-haspopup="true"
        aria-expanded={menuOpen ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        data-testid={dataTestIds.visitDetailsPage.customFormMenuButton(questionnaireId)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
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
    </Box>
  );

  return (
    <Section
      title={questionnaireTitle}
      titleWidget={titleWidget}
      dataTestId={dataTestIds.visitDetailsPage.customFormCard(questionnaireId)}
    >
      <QuestionnaireResponseViewer form={form} />
    </Section>
  );
};
