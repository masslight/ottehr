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
import type { ExamCardModalExamComponent } from 'config-types';
import { FC, useCallback, useMemo, useState } from 'react';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { ExamObservationComponentDTO } from 'utils';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type ExamPairedModalCheckboxProps = {
  label: string;
  leftName: string;
  rightName: string;
  leftConfig: ExamCardModalExamComponent;
  rightConfig: ExamCardModalExamComponent;
  abnormal?: boolean;
};

interface FlatOption {
  key: string;
  label: string;
  groupLabel: string;
  description?: string;
}

function buildAllOptions(config: ExamCardModalExamComponent): FlatOption[] {
  return Object.values(config.sections).flatMap((section) =>
    Object.values(section.groups).flatMap((group) =>
      Object.entries(group.options).map(([key, opt]) => ({
        key,
        label: opt.label,
        groupLabel: group.label,
        description: opt.description,
      }))
    )
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function useSideState(name: string) {
  const { value: field, update, delete: deleteField, isLoading } = useExamObservations(name);

  const componentMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    field.components?.forEach((c) => {
      if (c.value) map[c.code] = true;
    });
    return map;
  }, [field.components]);

  const hasAnySelected = Object.keys(componentMap).length > 0;

  return { field, update, deleteField, isLoading, componentMap, hasAnySelected };
}

export const ExamPairedModalCheckbox: FC<ExamPairedModalCheckboxProps> = ({
  label,
  leftName,
  rightName,
  leftConfig,
  rightConfig,
  abnormal,
}) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const border = '1px solid rgba(224, 224, 224, 1)';

  const left = useSideState(leftName);
  const right = useSideState(rightName);

  const leftOptions = useMemo(() => buildAllOptions(leftConfig), [leftConfig]);
  const rightOptions = useMemo(() => buildAllOptions(rightConfig), [rightConfig]);

  const leftDescMap = useMemo(() => {
    const map: Record<string, string> = {};
    leftOptions.forEach((o) => {
      if (o.description) map[o.key] = o.description;
    });
    return map;
  }, [leftOptions]);
  const rightDescMap = useMemo(() => {
    const map: Record<string, string> = {};
    rightOptions.forEach((o) => {
      if (o.description) map[o.key] = o.description;
    });
    return map;
  }, [rightOptions]);

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
  const isChecked = left.field.value === true || right.field.value === true || hasAnySelected;

  const toggleComponent = useCallback(
    (side: 'left' | 'right', optionKey: string, optionLabel: string, checked: boolean) => {
      const descMap = side === 'left' ? leftDescMap : rightDescMap;
      const desc = descMap[optionKey];
      const fullLabel = desc ? `${optionLabel}, ${desc}` : optionLabel;
      const setter = side === 'left' ? setDraftLeft : setDraftRight;
      const fieldComponents = side === 'left' ? left.field.components : right.field.components;

      setter((prev) => {
        const current = prev ?? fieldComponents ?? [];
        if (checked) {
          const existing = current.find((c) => c.code === optionKey);
          if (existing) {
            return current.map((c) => (c.code === optionKey ? { ...c, value: true, label: fullLabel } : c));
          }
          return [...current, { code: optionKey, label: fullLabel, value: true }];
        }
        return current.filter((c) => c.code !== optionKey);
      });
    },
    [left.field.components, right.field.components, leftDescMap, rightDescMap]
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

    setOpen(false);
    setDraftLeft(null);
    setDraftRight(null);

    if (dL) {
      const hasSelections = dL.some((c) => c.value);
      if (hasSelections) {
        left.update({ ...leftField, value: true, components: dL });
      } else if (leftField.resourceId) {
        left.update({ ...leftField, value: false, components: [] });
      }
      // If no selections and no resourceId, nothing to do — field was never saved
    }

    if (dR) {
      const hasSelections = dR.some((c) => c.value);
      if (hasSelections) {
        right.update({ ...rightField, value: true, components: dR });
      } else if (rightField.resourceId) {
        right.update({ ...rightField, value: false, components: [] });
      }
      // If no selections and no resourceId, nothing to do — field was never saved
    }
  }, [draftLeft, draftRight, left, right]);

  const onCheckboxChange = (value: boolean): void => {
    if (value) {
      left.update({ ...left.field, value: true });
      right.update({ ...right.field, value: true });
    } else if (hasAnySelected) {
      handleOpenModal();
    } else {
      if (left.field.resourceId) left.deleteField(left.field);
      if (right.field.resourceId) right.deleteField(right.field);
    }
  };

  // Build section keys from left config (left and right share the same sections)
  const sectionEntries = Object.entries(leftConfig.sections);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <StatelessExamCheckbox
          label={label}
          abnormal={abnormal}
          checked={isChecked}
          onChange={onCheckboxChange}
          disabled={left.isLoading || right.isLoading}
        />
        <IconButton onClick={handleOpenModal} size="small" sx={{ ml: 0.5, p: 0.25 }}>
          <EditOutlined sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
        </IconButton>
      </Box>

      {/* Show selected items from both sides */}
      {leftOptions.map(({ key, groupLabel, label: optLabel, description }) => {
        if (!left.componentMap[key]) return null;
        const displayText = description ? `${optLabel}, ${description}` : `${groupLabel}: ${optLabel}`;
        return (
          <Typography key={key} variant="body2" sx={{ pl: 3, fontSize: '0.8rem' }}>
            L: {displayText}
          </Typography>
        );
      })}
      {rightOptions.map(({ key, groupLabel, label: optLabel, description }) => {
        if (!right.componentMap[key]) return null;
        const displayText = description ? `${optLabel}, ${description}` : `${groupLabel}: ${optLabel}`;
        return (
          <Typography key={key} variant="body2" sx={{ pl: 3, fontSize: '0.8rem' }}>
            R: {displayText}
          </Typography>
        );
      })}

      <Dialog open={open} onClose={handleCloseModal} maxWidth="lg" fullWidth disablePortal>
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
          {label}
          <IconButton onClick={handleCloseModal} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
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
                  const rightSection = rightConfig.sections[sectionKey];
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
                              {Object.entries(group.options).map(([optionKey, option]) => (
                                <FormControlLabel
                                  key={optionKey}
                                  sx={{ m: 0, mr: 1 }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      disabled={left.isLoading}
                                      sx={{
                                        '&.Mui-checked': {
                                          color: abnormal ? theme.palette.error.main : theme.palette.success.main,
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
                              ))}
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
                                {Object.entries(group.options).map(([optionKey, option]) => (
                                  <FormControlLabel
                                    key={optionKey}
                                    sx={{ m: 0, mr: 1 }}
                                    control={
                                      <Checkbox
                                        size="small"
                                        disabled={right.isLoading}
                                        sx={{
                                          '&.Mui-checked': {
                                            color: abnormal ? theme.palette.error.main : theme.palette.success.main,
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
                                ))}
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
