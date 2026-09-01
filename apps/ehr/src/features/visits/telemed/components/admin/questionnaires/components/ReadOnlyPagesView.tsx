import AbcIcon from '@mui/icons-material/Abc';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import NumbersIcon from '@mui/icons-material/Numbers';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import SubjectIcon from '@mui/icons-material/Subject';
import { Box, Typography } from '@mui/material';
import { QuestionnaireItem } from 'fhir/r4b';
import { FC } from 'react';

const iconSx = { fontSize: 14 };
const TYPE_ICONS: Record<string, React.ReactNode> = {
  string: <AbcIcon sx={iconSx} />,
  text: <SubjectIcon sx={iconSx} />,
  boolean: <CheckBoxOutlinedIcon sx={iconSx} />,
  choice: <RadioButtonCheckedIcon sx={iconSx} />,
  'open-choice': <RadioButtonCheckedIcon sx={iconSx} />,
  integer: <NumbersIcon sx={iconSx} />,
  decimal: <NumbersIcon sx={iconSx} />,
  date: <CalendarTodayIcon sx={iconSx} />,
  attachment: <AttachFileIcon sx={iconSx} />,
  display: <InfoOutlinedIcon sx={iconSx} />,
  group: <FolderOutlinedIcon sx={iconSx} />,
};

const ReadOnlyItem: FC<{ item: QuestionnaireItem; depth: number }> = ({ item, depth }) => {
  const isGroup = item.type === 'group';
  const label = item.text || item.linkId || '(untitled)';

  return (
    <Box sx={{ ml: depth === 0 ? 0 : 2, mt: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
          {TYPE_ICONS[item.type] || TYPE_ICONS.string}
        </Box>
        <Typography
          variant="body2"
          sx={{ fontWeight: isGroup ? 600 : 400, color: isGroup ? '#0F347C' : 'text.primary' }}
        >
          {label}
        </Typography>
        {item.required && (
          <Typography variant="caption" sx={{ color: 'error.main' }}>
            *
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {item.type}
          {item.linkId ? ` · ${item.linkId}` : ''}
        </Typography>
      </Box>
      {item.item && item.item.length > 0 && (
        <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', ml: 0.75, pl: 1 }}>
          {item.item.map((child, i) => (
            <ReadOnlyItem key={child.linkId || i} item={child} depth={depth + 1} />
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * Read-only, non-interactive rendering of a Questionnaire's pages and their fields. Used for
 * system-managed forms whose items carry logic the visual editor cannot represent — the admin can see
 * the structure (page names, field names, types) but cannot edit, reorder, or drill into anything.
 */
export const ReadOnlyPagesView: FC<{ items: QuestionnaireItem[] }> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        This questionnaire has no pages.
      </Typography>
    );
  }

  return (
    <Box>
      {items.map((page, i) => (
        <Box
          key={page.linkId || i}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, mb: 1.5 }}
        >
          <ReadOnlyItem item={page} depth={0} />
        </Box>
      ))}
    </Box>
  );
};
