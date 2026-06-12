import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalculateIcon from '@mui/icons-material/Calculate';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { getDisplayOptionPrefix, getItemControl, getOptionDisplay, isScoreItem } from 'ui-components';
import { FhirQuestionnaire, QuestionnaireItem } from './questionnaire.types';

// Ottehr intake color palette
const COLORS = {
  primaryMain: '#0F347C',
  primaryDark: '#0A2143',
  secondaryMain: '#2169F5',
  textPrimary: '#212130',
  textSecondary: '#4F4F4F',
  selectedBg: '#E2F0FF',
  cardBg: '#F7F8F9',
  calloutBg: '#aed4fc',
  focusShadow: 'rgba(77, 21, 183, 0.25)',
  border: '#E0E0E0',
  pageBg: '#FFFFFF',
};

interface QuestionnairePreviewProps {
  questionnaire: FhirQuestionnaire;
}

// Bold input label matching Ottehr's BoldPurpleInputLabel
const OttehrLabel: FC<{ text: string; required?: boolean }> = ({ text, required }) => (
  <InputLabel
    shrink
    sx={{
      fontWeight: 700,
      fontSize: 16,
      color: COLORS.primaryMain,
      transform: 'none',
      position: 'relative',
      mb: 0.5,
    }}
  >
    {text}
    {required && (
      <Typography component="span" sx={{ color: '#EC6930', ml: 0.25 }}>
        *
      </Typography>
    )}
  </InputLabel>
);

// Ottehr-styled radio option
const OttehrRadioOption: FC<{ label: string; description?: string; selected?: boolean }> = ({
  label,
  description,
  selected,
}) => (
  <Box
    sx={{
      border: '1px solid',
      borderColor: selected ? COLORS.secondaryMain : COLORS.border,
      borderRadius: '8px',
      minHeight: 46,
      px: 2,
      py: 1,
      mb: 0.5,
      display: 'flex',
      alignItems: 'center',
      bgcolor: selected ? COLORS.selectedBg : COLORS.pageBg,
      cursor: 'default',
    }}
  >
    <Radio
      checked={selected}
      disabled
      size="small"
      icon={<RadioButtonUncheckedIcon sx={{ fontSize: 24, color: COLORS.border }} />}
      checkedIcon={<RadioButtonCheckedIcon sx={{ fontSize: 24, color: COLORS.secondaryMain }} />}
      sx={{ p: 0.5, mr: 1 }}
    />
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 500, color: COLORS.textPrimary }}>
        {label}
      </Typography>
      {description && (
        <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
          {description}
        </Typography>
      )}
    </Box>
  </Box>
);

// Ottehr-styled text field
const ottehrInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      boxShadow: `0 -0.5px 0px 3px ${COLORS.focusShadow}`,
    },
  },
};

function getItemGridWidth(item: QuestionnaireItem): number {
  const widthMap: Record<string, number> = { s: 4, m: 6, l: 7 };
  // Check the builder's inputWidth field first
  if (item.inputWidth && widthMap[item.inputWidth]) return widthMap[item.inputWidth];
  // Fall back to reading from FHIR extension array
  const ext = (item as any).extension as { url: string; valueString?: string }[] | undefined;
  const widthExt = ext?.find((e) => e.url?.includes('input-width'))?.valueString;
  if (widthExt && widthMap[widthExt]) return widthMap[widthExt];
  return 12;
}

const OpenChoiceSelectPreview: FC<{ item: QuestionnaireItem }> = ({ item }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuWidth, setMenuWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = (): void => setMenuWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box ref={containerRef} sx={{ mb: 1.5 }}>
      <OttehrLabel text={item.text || item.linkId} required={item.required} />
      <Select
        size="small"
        value=""
        displayEmpty
        fullWidth
        sx={{ borderRadius: '8px' }}
        MenuProps={
          menuWidth != null
            ? { PaperProps: { sx: { minWidth: `${menuWidth}px !important`, maxWidth: `${menuWidth}px` } } }
            : {}
        }
      >
        <MenuItem value="">Select or type...</MenuItem>
        {(item.answerOption || []).map((opt, i) => (
          <MenuItem key={i} value={opt.valueString || i}>
            {opt.valueString || `Option ${i + 1}`}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
};

const ItemPreview: FC<{ item: QuestionnaireItem }> = ({ item }) => {
  switch (item.type) {
    case 'group':
      return (
        <Box sx={{ bgcolor: COLORS.cardBg, borderRadius: '8px', p: 3, mb: 2 }}>
          <Typography variant="h5" sx={{ color: COLORS.primaryMain, fontWeight: 600, mb: 2 }}>
            {item.text || item.linkId}
          </Typography>
          <Grid container spacing={1.5}>
            {(item.item || []).map((child, childIdx) => (
              <Grid item xs={getItemGridWidth(child)} key={`${child._key || child.linkId}-${childIdx}`}>
                <ItemPreview item={child} />
              </Grid>
            ))}
          </Grid>
        </Box>
      );

    case 'display':
      return (
        <Box
          sx={{
            bgcolor: COLORS.calloutBg,
            borderRadius: '8px',
            p: 2,
            mb: 1.5,
          }}
        >
          <Typography variant="body1" sx={{ color: COLORS.primaryMain }}>
            {item.text}
          </Typography>
        </Box>
      );

    case 'boolean':
      return (
        <Box sx={{ mb: 1.5 }}>
          <FormControlLabel
            control={<Checkbox size="small" sx={{ color: COLORS.secondaryMain }} />}
            label={
              <Typography variant="body1" sx={{ fontWeight: 500, color: COLORS.textPrimary }}>
                {item.text || item.linkId}
              </Typography>
            }
          />
        </Box>
      );

    case 'choice': {
      // The local QuestionnaireItem type's `extension` field is loosely typed
      // (`Record<string, unknown>[]`) while the helpers in ui-components expect
      // fhir4b.Extension with required `url`. Runtime shapes match — extensions
      // imported from FHIR JSON always have url. Cast as needed for the helper.
      const itemControl = getItemControl(item as unknown as Parameters<typeof getItemControl>[0]);
      const useDropdown = itemControl === 'drop-down' || (item.answerOption?.length || 0) > 6;
      const options = item.answerOption || [];

      return (
        <FormControl sx={{ mb: 1.5, width: '100%' }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          {useDropdown ? (
            <Select size="small" value="" displayEmpty sx={{ borderRadius: '8px' }}>
              <MenuItem value="">Select...</MenuItem>
              {options.map((opt, i) => {
                const prefix = getDisplayOptionPrefix(opt);
                const display = getOptionDisplay(opt);
                return (
                  <MenuItem key={i} value={opt.valueString || opt.valueCoding?.code || i}>
                    {prefix !== undefined ? `${prefix}. ` : ''}
                    {display}
                  </MenuItem>
                );
              })}
            </Select>
          ) : (
            <RadioGroup>
              {options.map((opt, i) => {
                const prefix = getDisplayOptionPrefix(opt);
                const display = getOptionDisplay(opt);
                const label = `${prefix !== undefined ? `${prefix}. ` : ''}${display}`;
                return <OttehrRadioOption key={i} label={label} selected={i === 0} />;
              })}
            </RadioGroup>
          )}
        </FormControl>
      );
    }

    case 'open-choice':
      return <OpenChoiceSelectPreview item={item} />;

    case 'date':
    case 'dateTime':
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField
            size="small"
            type={item.type === 'date' ? 'date' : 'datetime-local'}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={ottehrInputSx}
          />
        </Box>
      );

    case 'time':
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField size="small" type="time" fullWidth InputLabelProps={{ shrink: true }} sx={ottehrInputSx} />
        </Box>
      );

    case 'integer':
    case 'quantity':
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField
            size="small"
            type="number"
            fullWidth
            placeholder={item.type === 'quantity' ? 'Value + units' : undefined}
            inputProps={item.maxLength ? { maxLength: item.maxLength } : undefined}
            sx={ottehrInputSx}
          />
        </Box>
      );

    case 'decimal':
      if (isScoreItem(item as unknown as Parameters<typeof isScoreItem>[0])) {
        return (
          <Box
            sx={{
              mb: 1.5,
              mt: 1,
              p: 2,
              bgcolor: COLORS.cardBg,
              borderRadius: '8px',
              border: '1px solid',
              borderColor: COLORS.border,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <CalculateIcon sx={{ color: COLORS.secondaryMain, fontSize: 28 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: COLORS.primaryMain }}>
                {item.text || item.linkId}
              </Typography>
              <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
                Auto-calculated from scored items above
              </Typography>
            </Box>
            <Chip label="Score" size="small" sx={{ bgcolor: COLORS.secondaryMain, color: '#fff', fontWeight: 600 }} />
          </Box>
        );
      }
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField
            size="small"
            type="number"
            fullWidth
            inputProps={item.maxLength ? { maxLength: item.maxLength } : undefined}
            sx={ottehrInputSx}
          />
        </Box>
      );

    case 'text':
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={3}
            inputProps={item.maxLength ? { maxLength: item.maxLength } : undefined}
            sx={ottehrInputSx}
          />
        </Box>
      );

    case 'url':
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField size="small" type="url" fullWidth placeholder="https://" sx={ottehrInputSx} />
        </Box>
      );

    case 'attachment':
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <Box
            sx={{
              border: '2px dashed',
              borderColor: COLORS.border,
              borderRadius: '8px',
              p: 3,
              textAlign: 'center',
              bgcolor: COLORS.cardBg,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Click or drag to upload
            </Typography>
          </Box>
        </Box>
      );

    case 'reference':
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField size="small" fullWidth placeholder="Search..." sx={ottehrInputSx} />
        </Box>
      );

    // string is the default
    default:
      return (
        <Box sx={{ mb: 1.5 }}>
          <OttehrLabel text={item.text || item.linkId} required={item.required} />
          <TextField
            size="small"
            fullWidth
            inputProps={item.maxLength ? { maxLength: item.maxLength } : undefined}
            sx={ottehrInputSx}
          />
        </Box>
      );
  }
};

export const QuestionnairePreview: FC<QuestionnairePreviewProps> = ({ questionnaire }) => {
  // Treat top-level group items as pages (Ottehr convention)
  const pages = useMemo(() => {
    const items = questionnaire.item || [];
    const topLevelGroups = items.filter((item) => item.type === 'group');
    // If there are top-level groups, treat them as pages; otherwise show all items as one page
    if (topLevelGroups.length > 0) return topLevelGroups;
    return items.length > 0 ? [{ linkId: 'all', text: questionnaire.title, type: 'group' as const, item: items }] : [];
  }, [questionnaire]);

  const [currentPage, setCurrentPage] = useState(0);

  if (pages.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        Add items to see the form preview.
      </Typography>
    );
  }

  const safeCurrentPage = Math.min(currentPage, pages.length - 1);
  const page = pages[safeCurrentPage];
  const isFirst = safeCurrentPage === 0;
  const isLast = safeCurrentPage === pages.length - 1;

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          bgcolor: '#F5F5F5',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 3,
          px: 2,
          transform: 'scale(0.75)',
          transformOrigin: 'top left',
          width: '133.33%',
        }}
      >
        {/* Page progress indicator */}
        {pages.length > 1 && (
          <Box sx={{ display: 'flex', gap: 0.5, width: '100%', maxWidth: 900, mb: 2 }}>
            {pages.map((_, idx) => (
              <Box
                key={idx}
                onClick={() => setCurrentPage(idx)}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: idx <= safeCurrentPage ? COLORS.secondaryMain : COLORS.border,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              />
            ))}
          </Box>
        )}

        {/* Card container — matches Ottehr's Container maxWidth="md" + Card pattern */}
        <Box
          sx={{
            width: '100%',
            maxWidth: 900,
            bgcolor: COLORS.pageBg,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: COLORS.border,
            boxShadow: '0px 1px 3px rgba(0,0,0,0.08)',
            p: { xs: 3, md: 5 },
          }}
        >
          {/* Page title */}
          <Typography
            variant="h5"
            sx={{
              color: COLORS.primaryMain,
              fontWeight: 700,
              mb: 0.5,
            }}
          >
            {page.text || page.linkId}
          </Typography>
          {safeCurrentPage === 0 && questionnaire.description && (
            <Typography variant="body2" sx={{ color: COLORS.secondaryMain, fontSize: 18, mb: 2 }}>
              {questionnaire.description}
            </Typography>
          )}

          {/* Page items */}
          <Grid container spacing={1.5} sx={{ mt: 1 }}>
            {(page.item || []).map((item, idx) => (
              <Grid item xs={getItemGridWidth(item)} key={`${item._key || item.linkId}-${idx}`}>
                <ItemPreview item={item} />
              </Grid>
            ))}
          </Grid>

          {/* Navigation buttons */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mt: 4,
              pt: 2,
              borderTop: '1px solid',
              borderColor: COLORS.border,
            }}
          >
            {!isFirst ? (
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => setCurrentPage((p) => p - 1)}
                sx={{
                  borderRadius: '50px',
                  textTransform: 'none',
                  fontWeight: 600,
                  color: COLORS.secondaryMain,
                  borderColor: COLORS.secondaryMain,
                }}
              >
                Back
              </Button>
            ) : (
              <Box />
            )}
            <Button
              variant="contained"
              onClick={() => !isLast && setCurrentPage((p) => p + 1)}
              sx={{
                borderRadius: '50px',
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: COLORS.secondaryMain,
                px: 4,
                '&:hover': { bgcolor: COLORS.primaryMain },
              }}
            >
              {isLast ? 'Submit' : 'Continue'}
            </Button>
          </Box>

          {/* Page indicator */}
          {pages.length > 1 && (
            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'center', mt: 1, color: COLORS.textSecondary }}
            >
              Page {safeCurrentPage + 1} of {pages.length}
            </Typography>
          )}
        </Box>
        {/* end card */}
      </Box>
    </Box>
  );
};
