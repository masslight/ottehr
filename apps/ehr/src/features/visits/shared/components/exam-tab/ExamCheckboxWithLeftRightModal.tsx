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
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import type { ExamCardCheckboxWithModalComponent } from 'config-types';
import { FC, useCallback, useMemo, useState } from 'react';
import { Delete, Update, useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { ExamObservationComponentDTO, ExamObservationDTO } from 'utils';
import { BORDER_STYLE, buildAbnormalMap, buildAllOptions, buildDescriptionMap } from './exam-modal-helpers';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type ExamCheckboxWithLeftRightModalProps = {
  label: string;
  baseName: string;
  leftName: string;
  rightName: string;
  leftConfig: ExamCardCheckboxWithModalComponent;
  rightConfig: ExamCardCheckboxWithModalComponent;
  abnormal?: boolean;
};

function useSideState(name: string): {
  field: ExamObservationDTO;
  updateField: Update;
  deleteField: Delete;
  isLoading: boolean;
  componentMap: Record<string, boolean>;
  hasAnySelected: boolean;
} {
  const { value: field, update: updateField, delete: deleteField, isLoading } = useExamObservations(name);

  const componentMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    field.components?.forEach((c) => {
      if (c.value) map[c.code] = true;
    });
    return map;
  }, [field.components]);

  const hasAnySelected = Object.keys(componentMap).length > 0;

  return { field, updateField, deleteField, isLoading, componentMap, hasAnySelected };
}

export const ExamCheckboxWithLeftRightModal: FC<ExamCheckboxWithLeftRightModalProps> = ({
  label,
  baseName,
  leftName,
  rightName,
  leftConfig,
  rightConfig,
  abnormal,
}) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  const base = useSideState(baseName);
  const left = useSideState(leftName);
  const right = useSideState(rightName);

  const leftOptions = useMemo(() => buildAllOptions(leftConfig), [leftConfig]);
  const rightOptions = useMemo(() => buildAllOptions(rightConfig), [rightConfig]);

  const leftAbnormalMap = useMemo(() => buildAbnormalMap(leftOptions), [leftOptions]);
  const rightAbnormalMap = useMemo(() => buildAbnormalMap(rightOptions), [rightOptions]);
  const leftDescMap = useMemo(() => buildDescriptionMap(leftOptions), [leftOptions]);
  const rightDescMap = useMemo(() => buildDescriptionMap(rightOptions), [rightOptions]);

  // Draft state for batched save
  const [draftLeft, setDraftLeft] = useState<ExamObservationComponentDTO[] | null>(null);
  const [draftRight, setDraftRight] = useState<ExamObservationComponentDTO[] | null>(null);

  const leftComponentMap = useMemo(() => {
    const components = draftLeft ?? left.field.components ?? [];
    const map: Record<string, boolean> = {};
    components.forEach((c) => {
      if (c.value) map[c.code] = true;
    });
    return map;
  }, [draftLeft, left.field.components]);

  const rightComponentMap = useMemo(() => {
    const components = draftRight ?? right.field.components ?? [];
    const map: Record<string, boolean> = {};
    components.forEach((c) => {
      if (c.value) map[c.code] = true;
    });
    return map;
  }, [draftRight, right.field.components]);

  const hasAnySelected = left.hasAnySelected || right.hasAnySelected;
  const isChecked =
    base.field.value === true || left.field.value === true || right.field.value === true || hasAnySelected;

  const toggleComponent = useCallback(
    (side: 'left' | 'right', optionKey: string, optionLabel: string, checked: boolean) => {
      const descMap = side === 'left' ? leftDescMap : rightDescMap;
      const abnMap = side === 'left' ? leftAbnormalMap : rightAbnormalMap;
      const desc = descMap[optionKey];
      const fullLabel = desc ?? optionLabel;
      const isAbnormal = abnMap[optionKey] ?? true;
      const setter = side === 'left' ? setDraftLeft : setDraftRight;
      const fieldComponents = side === 'left' ? left.field.components : right.field.components;

      setter((prev) => {
        const current = prev ?? fieldComponents ?? [];
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
    [left.field.components, right.field.components, leftDescMap, rightDescMap, leftAbnormalMap, rightAbnormalMap]
  );

  const handleOpenModal = (): void => {
    setDraftLeft(left.field.components ?? []);
    setDraftRight(right.field.components ?? []);
    setOpen(true);
  };

  const handleCloseModal = useCallback((): void => {
    const dL = draftLeft;
    const dR = draftRight;
    const leftField = left.field;
    const rightField = right.field;
    const baseField = base.field;

    setOpen(false);
    setDraftLeft(null);
    setDraftRight(null);

    const leftHasSelections = dL?.some((c) => c.value) ?? false;
    const rightHasSelections = dR?.some((c) => c.value) ?? false;

    // If any lateralized items are selected, remove the generic parent observation
    if ((leftHasSelections || rightHasSelections) && baseField.resourceId) {
      base.deleteField(baseField);
    }

    if (dL) {
      if (leftHasSelections) {
        left.updateField({ ...leftField, value: true, components: dL });
      } else if (leftField.resourceId) {
        left.updateField({ ...leftField, value: false, components: [] });
      }
    }

    if (dR) {
      if (rightHasSelections) {
        right.updateField({ ...rightField, value: true, components: dR });
      } else if (rightField.resourceId) {
        right.updateField({ ...rightField, value: false, components: [] });
      }
    }

    // If all lateralized items were removed, also clear the base observation
    if (!leftHasSelections && !rightHasSelections && baseField.resourceId) {
      base.deleteField(baseField);
    }
  }, [draftLeft, draftRight, left, right, base]);

  const onCheckboxChange = (value: boolean): void => {
    if (value) {
      base.updateField({ ...base.field, value: true });
    } else if (hasAnySelected) {
      handleOpenModal();
    } else {
      if (base.field.resourceId) base.deleteField(base.field);
      if (left.field.resourceId) left.deleteField(left.field);
      if (right.field.resourceId) right.deleteField(right.field);
    }
  };

  // Build section keys from left config (left and right share the same sections)
  const sectionEntries = Object.entries(leftConfig.modal);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <StatelessExamCheckbox
          label={label}
          abnormal={abnormal}
          checked={isChecked}
          onChange={onCheckboxChange}
          disabled={base.isLoading || left.isLoading || right.isLoading}
        />
        <IconButton onClick={handleOpenModal} size="small" sx={{ ml: 0.5, p: 0.25 }}>
          <EditOutlined sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
        </IconButton>
      </Box>

      {/* Show selected items consolidated by side and group */}
      {(['left', 'right'] as const).map((side) => {
        const sideOptions = side === 'left' ? leftOptions : rightOptions;
        const sideMap = side === 'left' ? left.componentMap : right.componentMap;
        const sideLabel = side === 'left' ? 'L' : 'R';
        const selected = sideOptions.filter(({ key }) => sideMap[key]);
        if (selected.length === 0) return null;

        // Group by groupLabel
        const grouped = new Map<string, { labels: string[]; abnormal: boolean }>();
        selected.forEach(({ groupLabel, label: optLabel, description, abnormal: optAbn }) => {
          const displayText = description ?? optLabel;
          const existing = grouped.get(groupLabel);
          const isAbn = optAbn ?? true;
          if (existing) {
            existing.labels.push(displayText);
            if (isAbn) existing.abnormal = true;
          } else {
            grouped.set(groupLabel, { labels: [displayText], abnormal: isAbn });
          }
        });

        return Array.from(grouped.entries()).map(([groupLabel, { labels, abnormal: isAbn }]) => (
          <Typography
            key={`${side}-${groupLabel}`}
            variant="body2"
            sx={{
              pl: 3,
              fontSize: '0.8rem',
              color: isAbn ? theme.palette.error.main : theme.palette.success.main,
              fontWeight: isAbn ? 600 : 400,
            }}
          >
            ✓ {sideLabel}: {groupLabel}: {labels.join(', ')}
          </Typography>
        ));
      })}

      <Dialog open={open} onClose={handleCloseModal} maxWidth="lg" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            color: theme.palette.primary.dark,
            fontWeight: 600,
            borderBottom: BORDER_STYLE,
            py: 1.5,
          }}
        >
          {label}
          <IconButton onClick={handleCloseModal} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <TableContainer component={Paper} elevation={0} sx={{ BORDER_STYLE }}>
            <Table
              size="small"
              sx={{
                tableLayout: 'fixed',
                '& .MuiTableCell-root': {
                  borderRight: BORDER_STYLE,
                  borderBottom: BORDER_STYLE,
                },
                '& .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root': {
                  borderBottom: 'none',
                },
                '& .MuiTableCell-root:last-child': {
                  borderRight: 'none',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      fontWeight: 500,
                      color: theme.palette.primary.dark,
                      width: '130px',
                    }}
                  />
                  <TableCell
                    sx={{
                      backgroundColor: alpha(theme.palette.primary.main, 0.03),
                      fontWeight: 600,
                      color: theme.palette.primary.dark,
                      textAlign: 'center',
                    }}
                  >
                    Left
                  </TableCell>
                  <TableCell
                    sx={{
                      backgroundColor: alpha(theme.palette.primary.main, 0.03),
                      fontWeight: 600,
                      color: theme.palette.primary.dark,
                      textAlign: 'center',
                    }}
                  >
                    Right
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sectionEntries.map(([sectionKey, section]) => {
                  const rightSection = rightConfig.modal[sectionKey];
                  return (
                    <TableRow key={sectionKey} sx={{ '& .MuiTableCell-root': { verticalAlign: 'top' } }}>
                      <TableCell
                        sx={{
                          backgroundColor: alpha(theme.palette.primary.main, 0.05),
                          fontWeight: 500,
                          color: theme.palette.primary.dark,
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
                                const optAbn = option.abnormal ?? true;
                                return (
                                  <FormControlLabel
                                    key={optionKey}
                                    sx={{ m: 0, mr: 1 }}
                                    control={
                                      <Checkbox
                                        size="small"
                                        disabled={left.isLoading}
                                        sx={{
                                          '&.Mui-checked': {
                                            color: optAbn ? theme.palette.error.main : theme.palette.success.main,
                                          },
                                          p: 0.5,
                                        }}
                                        checked={leftComponentMap[optionKey] ?? false}
                                        onChange={(e) =>
                                          toggleComponent(
                                            'left',
                                            optionKey,
                                            `${group.label}: ${option.label}`,
                                            e.target.checked
                                          )
                                        }
                                      />
                                    }
                                    label={<Typography fontSize={13}>{option.label}</Typography>}
                                  />
                                );
                              })}
                            </Box>
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {rightSection && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {Object.entries(rightSection.groups).map(([groupKey, group]) => (
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
                                  const optAbn = option.abnormal ?? true;
                                  return (
                                    <FormControlLabel
                                      key={optionKey}
                                      sx={{ m: 0, mr: 1 }}
                                      control={
                                        <Checkbox
                                          size="small"
                                          disabled={right.isLoading}
                                          sx={{
                                            '&.Mui-checked': {
                                              color: optAbn ? theme.palette.error.main : theme.palette.success.main,
                                            },
                                            p: 0.5,
                                          }}
                                          checked={rightComponentMap[optionKey] ?? false}
                                          onChange={(e) =>
                                            toggleComponent(
                                              'right',
                                              optionKey,
                                              `${group.label}: ${option.label}`,
                                              e.target.checked
                                            )
                                          }
                                        />
                                      }
                                      label={<Typography fontSize={13}>{option.label}</Typography>}
                                    />
                                  );
                                })}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
