import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Autocomplete,
  Button,
  Checkbox,
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  SxProps,
  TextField,
  Typography,
} from '@mui/material';
import { Box, Stack } from '@mui/system';
import { ReactElement, useState } from 'react';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { woundSiteLabel } from 'utils/lib/procedure-coding/codec';
import {
  LacerationComplexElement,
  LacerationRepairDepth,
  LacerationWound,
} from 'utils/lib/procedure-coding/facts.types';
import { FieldOption, WoundMapManifest } from 'utils/lib/procedure-coding/manifests';

type WoundMap = Record<string, LacerationWound[]>;

/** Shared MUI select for manifest option lists (also used by StructuredFactsFields). */
export function OptionSelect(props: {
  label: string;
  labelId: string;
  options: FieldOption[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  sx?: SxProps;
  fullWidth?: boolean;
  testId?: string;
}): ReactElement {
  return (
    <FormControl fullWidth={props.fullWidth} sx={props.sx} size="small" disabled={props.disabled}>
      <InputLabel id={props.labelId}>{props.label}</InputLabel>
      <Select
        label={props.label}
        labelId={props.labelId}
        variant="outlined"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        data-testid={props.testId}
      >
        {props.options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
              {option.label}
            </Typography>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

interface LacerationWoundsFieldProps {
  manifest: WoundMapManifest;
  wounds: WoundMap | undefined;
  onChange: (wounds: WoundMap | undefined) => void;
  isReadOnly: boolean;
}

/**
 * Sided body-site multi-select plus per-site wound rows (length + repair
 * depth, "+ another wound" for same-site additional wounds, and a collapsed
 * per-wound details disclosure with the CPT complex elements and the
 * contamination checkbox).
 */
export function LacerationWoundsField({
  manifest,
  wounds,
  onChange,
  isReadOnly,
}: LacerationWoundsFieldProps): ReactElement {
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const woundMap: WoundMap = wounds ?? {};

  // Paired sites are offered only sided; midline sites bare; 'other' allowed
  // (yields review-not-authoritative coding).
  const siteOptions: FieldOption[] = [
    ...[
      ...manifest.pairedSites.flatMap((site) => [
        { value: `${site.value}-left`, label: `${site.label} — Left` },
        { value: `${site.value}-right`, label: `${site.label} — Right` },
      ]),
      ...manifest.unsidedSites,
    ].sort((a, b) => a.label.localeCompare(b.label)),
    manifest.otherOption,
  ];

  // Legacy-imported keys (e.g. 'arm-unsided') aren't offered by the select but
  // must remain visible/removable when present in stored data; the shared codec
  // formatter turns them into a readable label.
  const optionForKey = (key: string): FieldOption =>
    siteOptions.find((option) => option.value === key) ?? { value: key, label: woundSiteLabel(manifest, key) };
  const selectedKeys = Object.keys(woundMap);

  const setSelectedKeys = (keys: string[]): void => {
    const next: WoundMap = {};
    keys.forEach((key) => {
      next[key] = woundMap[key] ?? [{}];
    });
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const updateWound = (siteKey: string, index: number, mutate: (wound: LacerationWound) => LacerationWound): void => {
    const siteWounds = [...(woundMap[siteKey] ?? [])];
    siteWounds[index] = mutate(siteWounds[index] ?? {});
    onChange({ ...woundMap, [siteKey]: siteWounds });
  };

  const removeWound = (siteKey: string, index: number): void => {
    const siteWounds = (woundMap[siteKey] ?? []).filter((_wound, woundIndex) => woundIndex !== index);
    // Expansion state is keyed by index, which just shifted — collapse the site's
    // detail disclosures so an unrelated wound doesn't inherit an open panel.
    setExpandedDetails((previous) => new Set([...previous].filter((key) => !key.startsWith(`${siteKey}-`))));
    onChange({ ...woundMap, [siteKey]: siteWounds.length > 0 ? siteWounds : [{}] });
  };

  const toggleDetails = (detailsKey: string): void =>
    setExpandedDetails((previous) => {
      const next = new Set(previous);
      if (next.has(detailsKey)) next.delete(detailsKey);
      else next.add(detailsKey);
      return next;
    });

  const woundRow = (siteKey: string, wound: LacerationWound, index: number): ReactElement => {
    const detailsKey = `${siteKey}-${index}`;
    const detailsAvailable = wound.depth != null && manifest.detailsDepths.includes(wound.depth);
    const detailsOpen = expandedDetails.has(detailsKey);
    return (
      <Box key={detailsKey} data-testid={dataTestIds.documentProcedurePage.lacerationWoundRow(siteKey, index)}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            label={manifest.lengthLabel}
            size="small"
            type="number"
            inputProps={{ min: 0, step: 0.1 }}
            sx={{ width: '140px' }}
            value={wound.lengthCm ?? ''}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              updateWound(siteKey, index, (previous) => ({
                ...previous,
                lengthCm: Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
              }));
            }}
            disabled={isReadOnly}
          />
          <OptionSelect
            label={manifest.depthLabel}
            labelId={`${detailsKey}-depth`}
            options={manifest.depthOptions}
            sx={{ backgroundColor: 'white', minWidth: '220px' }}
            value={wound.depth ?? ''}
            onChange={(value) =>
              updateWound(siteKey, index, (previous) => ({
                ...previous,
                depth: (value || undefined) as LacerationRepairDepth | undefined,
              }))
            }
            disabled={isReadOnly}
          />
          {detailsAvailable && (
            <Button
              size="small"
              sx={{ textTransform: 'none' }}
              endIcon={detailsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => toggleDetails(detailsKey)}
              data-testid={dataTestIds.documentProcedurePage.lacerationWoundDetailsToggle(siteKey, index)}
            >
              Wound details
            </Button>
          )}
          {!isReadOnly && (woundMap[siteKey]?.length ?? 0) > 1 && (
            <DeleteIconButton onClick={() => removeWound(siteKey, index)} />
          )}
        </Stack>
        {detailsAvailable && (
          <Collapse in={detailsOpen}>
            <Box sx={{ display: 'flex', flexDirection: 'column', pl: 2 }}>
              {manifest.complexElementOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      size="small"
                      checked={wound.complexElements?.includes(option.value as LacerationComplexElement) ?? false}
                      onChange={(_e, checked) =>
                        updateWound(siteKey, index, (previous) => {
                          const elements = (previous.complexElements ?? []).filter(
                            (element) => element !== option.value
                          );
                          if (checked) elements.push(option.value as LacerationComplexElement);
                          return { ...previous, complexElements: elements.length > 0 ? elements : undefined };
                        })
                      }
                    />
                  }
                  label={<Typography variant="body2">{option.label}</Typography>}
                  disabled={isReadOnly}
                />
              ))}
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={wound.contaminated === true}
                    onChange={(_e, checked) =>
                      updateWound(siteKey, index, (previous) => ({
                        ...previous,
                        contaminated: checked ? true : undefined,
                      }))
                    }
                  />
                }
                label={<Typography variant="body2">{manifest.contaminatedLabel}</Typography>}
                disabled={isReadOnly}
              />
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={siteOptions}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        value={selectedKeys.map(optionForKey)}
        onChange={(_e, newValues) => setSelectedKeys(newValues.map((option) => option.value))}
        renderInput={(params) => (
          <TextField
            {...params}
            label={manifest.label}
            data-testid={dataTestIds.documentProcedurePage.lacerationWoundSites}
          />
        )}
        disabled={isReadOnly}
      />
      {selectedKeys.map((siteKey) => (
        <Box key={siteKey} sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {optionForKey(siteKey).label}
          </Typography>
          {(woundMap[siteKey] ?? []).map((wound, index) => woundRow(siteKey, wound, index))}
          {!isReadOnly && (
            <Button
              size="small"
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
              onClick={() => onChange({ ...woundMap, [siteKey]: [...(woundMap[siteKey] ?? []), {}] })}
              data-testid={dataTestIds.documentProcedurePage.lacerationAddWoundButton(siteKey)}
            >
              {manifest.addWoundLabel.replace('{site}', optionForKey(siteKey).label)}
            </Button>
          )}
        </Box>
      ))}
    </Box>
  );
}
