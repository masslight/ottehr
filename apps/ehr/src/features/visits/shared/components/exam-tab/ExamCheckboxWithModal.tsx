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
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { ExamCardCheckboxWithModalComponent } from 'config-types/config/examination';
import { FC, useCallback, useMemo, useState } from 'react';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { ExamObservationComponentDTO } from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { buildAbnormalMap, buildAllOptionsNew, buildColumnMap, buildDescriptionMap } from './exam-modal-helpers';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type ExamCheckboxWithModalProps = {
  name: string;
  config: ExamCardCheckboxWithModalComponent;
  abnormal?: boolean;
};

const BORDER_STYLE = '1px solid rgba(224, 224, 224, 1)';

export const ExamCheckboxWithModal: FC<ExamCheckboxWithModalProps> = ({ name, config, abnormal }) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const { value: field, update: updateField, delete: deleteField, isLoading } = useExamObservations(name);

  // Local draft of components while modal is open — avoids saving on every click
  const [draftComponents, setDraftComponents] = useState<ExamObservationComponentDTO[] | null>(null);

  const allOptions = useMemo(() => buildAllOptionsNew(config), [config]);

  // Build lookups from config
  const columns = useMemo(() => buildColumnMap(allOptions), [allOptions]);
  const descriptionMap = useMemo(() => buildDescriptionMap(allOptions), [allOptions]);
  const abnormalMap = useMemo(() => buildAbnormalMap(allOptions), [allOptions]);

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
    (optionKey: string, columnLabel: string | undefined, groupLabel: string, label: string, checked: boolean) => {
      const desc = descriptionMap[optionKey];
      const fullLabel = desc ?? label;

      // this shouldn't happen and is probably a bug, so alerting
      if (!abnormalMap[optionKey]) {
        safelyCaptureException(
          `Possible exam config error, could not find an abnormal attribute for "optionKey: ${optionKey}" "columnLabel: ${columnLabel} "groupLabel: ${groupLabel}"`
        );
      }

      const isAbnormal = abnormalMap[optionKey] ?? true;

      setDraftComponents((prev) => {
        const current = prev ?? field.components ?? [];
        if (checked) {
          const existing = current.find((c) => c.code === optionKey);
          if (existing) {
            return current.map((c) =>
              c.code === optionKey
                ? { ...c, value: true, groupLabel, label: fullLabel, abnormal: isAbnormal, columnLabel }
                : c
            );
          }
          return [
            ...current,
            { code: optionKey, groupLabel, label: fullLabel, value: true, abnormal: isAbnormal, columnLabel },
          ];
        }
        return current.filter((c) => c.code !== optionKey);
      });
    },
    [field.components, descriptionMap, abnormalMap]
  );

  const onCheckboxChange = (value: boolean): void => {
    if (value) {
      updateField({ ...field, value: true });
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
        updateField({
          ...currentField,
          value: true,
          components: draft,
        });
      } else if (currentField.resourceId) {
        updateField({
          ...currentField,
          value: false,
          components: [],
        });
      }
      // If no selections and no resourceId, nothing to do — field was never saved
    }
  }, [draftComponents, field, updateField]);

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

      {Object.entries(columns).map(([header, allOptions]) => {
        const selected = allOptions.filter(({ key }) => componentMap[key]);
        if (selected.length === 0) return null;

        const grouped = new Map<string, { groupLabel: string; labels: string[]; abnormal: boolean }>();
        selected.forEach(({ groupLabel, label: optLabel, headerAbbreviation, description, abnormal: optAbn }) => {
          const displayText = description ?? optLabel;
          const fullGroupLabel = `${headerAbbreviation ? `${headerAbbreviation}: ` : ''}${groupLabel}`;
          const fullGroupKey = `${headerAbbreviation ? `${headerAbbreviation}-` : ''}${groupLabel}`;
          const existing = grouped.get(fullGroupKey);
          const isAbn = optAbn ?? true;
          if (existing) {
            existing.labels.push(displayText);
            if (isAbn) existing.abnormal = true;
          } else {
            grouped.set(fullGroupKey, { groupLabel: fullGroupLabel, labels: [displayText], abnormal: isAbn });
          }
        });

        return Array.from(grouped.entries()).map(([groupKey, { groupLabel, labels, abnormal: isAbn }]) => (
          <Typography
            key={`${header}-${groupKey}`}
            variant="body2"
            sx={{
              pl: 3,
              fontSize: '0.8rem',
              color: isAbn ? theme.palette.error.main : theme.palette.success.main,
              fontWeight: isAbn ? 600 : 400,
            }}
          >
            ✓ {groupLabel}: {labels.join(', ')}
          </Typography>
        ));
      })}

      <Dialog open={open} onClose={handleCloseModal} maxWidth={Object.keys(columns).length > 1 ? 'lg' : 'md'} fullWidth>
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
          <TableContainer component={Paper} elevation={0} sx={{ border: BORDER_STYLE }}>
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
              {Object.values(columns).length > 1 ? (
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
                    {Object.keys(columns).map((header) => (
                      <TableCell
                        key={`modal-column-header-${header}`}
                        sx={{
                          backgroundColor: alpha(theme.palette.primary.main, 0.03),
                          fontWeight: 600,
                          color: theme.palette.primary.dark,
                          textAlign: 'center',
                        }}
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
              ) : null}
              <TableBody>
                {Object.entries(config.modal).map(([sectionKey, section]) => (
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
                    {Object.entries(section.columns).map(([columnKey, column]) => (
                      <TableCell key={columnKey} sx={{ py: 1 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {Object.entries(column.groups).map(([groupKey, group]) => (
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
                                const control = (
                                  <FormControlLabel
                                    key={optionKey}
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
                                        onChange={(e) => {
                                          const columnLabel = column.headerAbbreviation;
                                          const groupLabel = group.label;
                                          toggleComponent(
                                            optionKey,
                                            columnLabel,
                                            groupLabel,
                                            option.label,
                                            e.target.checked
                                          );
                                        }}
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
                                );
                                return option.description ? (
                                  <Tooltip
                                    key={optionKey}
                                    title={option.description}
                                    placement="top"
                                    arrow
                                    slotProps={{
                                      popper: { modifiers: [{ name: 'offset', options: { offset: [0, -8] } }] },
                                    }}
                                  >
                                    {control}
                                  </Tooltip>
                                ) : (
                                  control
                                );
                              })}
                            </Box>
                          ))}
                        </Box>
                      </TableCell>
                    ))}
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
