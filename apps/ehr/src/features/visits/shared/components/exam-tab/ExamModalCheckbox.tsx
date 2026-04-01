import { Close, EditOutlined } from '@mui/icons-material';
import {
  alpha,
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import type { ExamCardModalExamComponent } from 'config-types';
import { FC, useCallback, useMemo, useState } from 'react';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { ExamObservationComponentDTO } from 'utils';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type ExamModalCheckboxProps = {
  name: string;
  config: ExamCardModalExamComponent;
  abnormal?: boolean;
};

interface FlatOption {
  key: string;
  label: string;
  groupLabel: string;
  description?: string;
  abnormal?: boolean;
}

function buildAllOptions(config: ExamCardModalExamComponent): FlatOption[] {
  return Object.values(config.sections).flatMap((section) =>
    Object.values(section.groups).flatMap((group) =>
      Object.entries(group.options).map(([key, opt]) => ({
        key,
        label: opt.label,
        groupLabel: group.label,
        description: opt.description,
        abnormal: opt.abnormal,
      }))
    )
  );
}

export const ExamModalCheckbox: FC<ExamModalCheckboxProps> = ({ name, config, abnormal }) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const { value: field, update, delete: deleteField, isLoading } = useExamObservations(name);

  // Local draft of components while modal is open — avoids saving on every click
  const [draftComponents, setDraftComponents] = useState<ExamObservationComponentDTO[] | null>(null);

  const border = '1px solid rgba(224, 224, 224, 1)';

  const allOptions = useMemo(() => buildAllOptions(config), [config]);

  // Build lookups from config
  const descriptionMap = useMemo(() => {
    const map: Record<string, string> = {};
    allOptions.forEach((opt) => {
      if (opt.description) map[opt.key] = opt.description;
    });
    return map;
  }, [allOptions]);

  const abnormalMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    allOptions.forEach((opt) => {
      map[opt.key] = opt.abnormal ?? true; // default to abnormal since parent is in abnormal section
    });
    return map;
  }, [allOptions]);

  // Use draft when modal is open, otherwise use saved data
  const componentMap = useMemo(() => {
    const components = draftComponents ?? field.components ?? [];
    const map: Record<string, boolean> = {};
    components.forEach((c) => {
      if (c.value) map[c.code] = true;
    });
    return map;
  }, [draftComponents, field.components]);

  const hasAnySubSelected = Object.keys(componentMap).length > 0;
  const isChecked = field.value === true || hasAnySubSelected;

  const toggleComponent = useCallback(
    (optionKey: string, label: string, checked: boolean) => {
      const desc = descriptionMap[optionKey];
      const fullLabel = desc ?? label;
      const isAbnormal = abnormalMap[optionKey] ?? true;
      setDraftComponents((prev) => {
        const current = prev ?? field.components ?? [];
        if (checked) {
          const existing = current.find((c) => c.code === optionKey);
          if (existing) {
            return current.map((c) =>
              c.code === optionKey ? { ...c, value: true, label: fullLabel, abnormal: isAbnormal } : c
            );
          }
          return [...current, { code: optionKey, label: fullLabel, value: true, abnormal: isAbnormal }];
        }
        return current.filter((c) => c.code !== optionKey);
      });
    },
    [field.components, descriptionMap, abnormalMap]
  );

  const onCheckboxChange = (value: boolean): void => {
    if (value) {
      update({ ...field, value: true });
    } else if (hasAnySubSelected) {
      handleOpenModal();
    } else if (field.resourceId) {
      deleteField(field);
    }
  };

  const handleOpenModal = (): void => {
    setDraftComponents(field.components ?? []);
    setOpen(true);
  };

  const handleCloseModal = useCallback((): void => {
    // Capture draft and field before clearing state
    const draft = draftComponents;
    const currentField = field;

    // Close immediately
    setOpen(false);
    setDraftComponents(null);

    // Then save
    if (draft) {
      const hasSelections = draft.some((c) => c.value);
      if (hasSelections) {
        update({
          ...currentField,
          value: true,
          components: draft,
        });
      } else if (currentField.resourceId) {
        update({
          ...currentField,
          value: false,
          components: [],
        });
      }
      // If no selections and no resourceId, nothing to do — field was never saved
    }
  }, [draftComponents, field, update]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <StatelessExamCheckbox
          label={config.label}
          abnormal={abnormal}
          checked={isChecked}
          onChange={onCheckboxChange}
          disabled={isLoading}
        />
        <IconButton onClick={handleOpenModal} size="small" sx={{ ml: 0.5, p: 0.25 }}>
          <EditOutlined sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
        </IconButton>
      </Box>

      {allOptions.map(({ key, groupLabel, label, description, abnormal: optAbnormal }) => {
        if (!componentMap[key]) return null;
        const isAbn = optAbnormal ?? true;
        const displayText = description ?? `${groupLabel}: ${label}`;
        return (
          <Typography
            key={key}
            variant="body2"
            sx={{
              pl: 3,
              fontSize: '0.8rem',
              color: isAbn ? theme.palette.error.main : theme.palette.success.main,
              fontWeight: isAbn ? 600 : 400,
            }}
          >
            ✓ {displayText}
          </Typography>
        );
      })}

      <Dialog open={open} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            color: theme.palette.primary.dark,
            fontWeight: 600,
            borderBottom: border,
            py: 1.5,
          }}
        >
          {config.label}
          <IconButton onClick={handleCloseModal} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        {Object.keys(descriptionMap).length > 0 && (
          <Typography variant="body2" sx={{ px: 3, py: 1, color: 'text.secondary', fontStyle: 'italic' }}>
            Selecting a diagnosis will populate appropriate exam findings. Hover to view.
          </Typography>
        )}
        <DialogContent sx={{ p: 0 }}>
          <TableContainer component={Paper} elevation={0} sx={{ border }}>
            <Table
              size="small"
              sx={{
                tableLayout: 'fixed',
                '& .MuiTableCell-root': {
                  borderRight: border,
                  borderBottom: border,
                },
                '& .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root': {
                  borderBottom: 'none',
                },
                '& .MuiTableCell-root:last-child': {
                  borderRight: 'none',
                },
              }}
            >
              <TableBody>
                {Object.entries(config.sections).map(([sectionKey, section]) => (
                  <TableRow key={sectionKey} sx={{ '& .MuiTableCell-root': { verticalAlign: 'top' } }}>
                    <TableCell
                      sx={{
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        fontWeight: 500,
                        color: theme.palette.primary.dark,
                        width: '130px',
                        py: 1,
                      }}
                    >
                      {section.label}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {Object.entries(section.groups).map(([groupKey, group]) => (
                          <Box key={groupKey} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Typography
                              variant="subtitle2"
                              fontSize={13}
                              color={theme.palette.primary.dark}
                              sx={{ mr: 0.5, whiteSpace: 'nowrap' }}
                            >
                              {group.label}:
                            </Typography>
                            {Object.entries(group.options).map(([optionKey, option]) => {
                              const optAbnormal = option.abnormal ?? true;
                              const noteText = option.description ?? option.label;
                              return (
                                <Tooltip
                                  key={optionKey}
                                  title={noteText}
                                  placement="top"
                                  arrow
                                  slotProps={{
                                    popper: { modifiers: [{ name: 'offset', options: { offset: [0, -8] } }] },
                                  }}
                                >
                                  <FormControlLabel
                                    sx={{ m: 0, mr: 1.5 }}
                                    control={
                                      <Checkbox
                                        size="small"
                                        disabled={isLoading}
                                        sx={{
                                          '&.Mui-checked': {
                                            color: isLoading
                                              ? undefined
                                              : optAbnormal
                                              ? theme.palette.error.main
                                              : theme.palette.success.main,
                                          },
                                          p: 0.5,
                                        }}
                                        checked={componentMap[optionKey] ?? false}
                                        onChange={(e) =>
                                          toggleComponent(
                                            optionKey,
                                            `${group.label}: ${option.label}`,
                                            e.target.checked
                                          )
                                        }
                                      />
                                    }
                                    label={
                                      <Typography
                                        fontSize={14}
                                        fontWeight={componentMap[optionKey] && optAbnormal ? 600 : 400}
                                      >
                                        {option.label}
                                      </Typography>
                                    }
                                  />
                                </Tooltip>
                              );
                            })}
                          </Box>
                        ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
