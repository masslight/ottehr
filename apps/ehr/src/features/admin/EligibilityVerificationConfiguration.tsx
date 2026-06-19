import { otherColors } from '@ehrTheme/colors';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Radio,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement } from 'react';
import { DEFAULT_ELIGIBILITY_SHORT_LIST_CODES, MAX_ELIGIBILITY_SHORT_LIST_CODES } from 'utils';
import { BENEFIT_TYPE_CODES, BenefitTypeCode } from './eligibilityVerification.constants';
import {
  useAdminUpdateEligibilityVerificationConfig,
  useEligibilityVerificationConfig,
} from './eligibilityVerification.queries';

// Source-of-truth constants (also enforced server-side by the zod schema) live in `utils`.
const MAX_SHORT_LIST_CODES = MAX_ELIGIBILITY_SHORT_LIST_CODES;
const DEFAULT_SHORT_LIST_CODES = DEFAULT_ELIGIBILITY_SHORT_LIST_CODES;

// Sample values used purely to illustrate how copays render in the preview.
const PREVIEW_CARRIER = 'Example Health Plan';
const PREVIEW_IN_NETWORK_AMOUNT = '$25';
const PREVIEW_OUT_OF_NETWORK_AMOUNT = '$50';
const PREVIEW_PERIOD = 'Visit';

export default function EligibilityVerificationConfiguration(): ReactElement {
  const theme = useTheme();
  const [shortListCodes, setShortListCodes] = React.useState<Set<string>>(new Set(DEFAULT_SHORT_LIST_CODES));
  // The single code whose copay is surfaced on the Payment Considerations screen.
  const [primaryCode, setPrimaryCode] = React.useState<string | undefined>(DEFAULT_SHORT_LIST_CODES[0]);
  const [searchText, setSearchText] = React.useState('');

  const { data: config, isLoading } = useEligibilityVerificationConfig();
  const updateConfig = useAdminUpdateEligibilityVerificationConfig();

  // Hydrate local state from the persisted config once it loads.
  React.useEffect(() => {
    if (config) {
      setShortListCodes(new Set(config.shortListCodes));
      setPrimaryCode(config.primaryCode);
    }
  }, [config]);

  const atLimit = shortListCodes.size >= MAX_SHORT_LIST_CODES;

  const handleToggle = (code: string): void => {
    setShortListCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else if (next.size < MAX_SHORT_LIST_CODES) {
        next.add(code);
      }
      return next;
    });
  };

  const handleSetPrimary = (code: string): void => setPrimaryCode(code);

  // Keep the primary copay consistent with the short list: clear it when nothing is selected,
  // and default to the first selected code when the current primary is removed (or unset).
  React.useEffect(() => {
    setPrimaryCode((current) => {
      if (shortListCodes.size === 0) return undefined;
      if (current && shortListCodes.has(current)) return current;
      return BENEFIT_TYPE_CODES.find((item) => shortListCodes.has(item.code))?.code;
    });
  }, [shortListCodes]);

  // Selected codes are always pinned to the top (in canonical order); unselected codes appear
  // below, filtered by the search box (matches code or description, case-insensitive).
  const { selectedRows, otherRows } = React.useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const matches = (item: BenefitTypeCode): boolean =>
      query.length === 0 || item.code.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);

    const selectedRows: BenefitTypeCode[] = [];
    const otherRows: BenefitTypeCode[] = [];
    for (const item of BENEFIT_TYPE_CODES) {
      if (shortListCodes.has(item.code)) {
        selectedRows.push(item);
      } else if (matches(item)) {
        otherRows.push(item);
      }
    }
    return { selectedRows, otherRows };
  }, [shortListCodes, searchText]);

  const selectedBenefits = React.useMemo(
    () => BENEFIT_TYPE_CODES.filter((item) => shortListCodes.has(item.code)),
    [shortListCodes]
  );

  const primaryBenefit = React.useMemo(
    () => BENEFIT_TYPE_CODES.find((item) => item.code === primaryCode),
    [primaryCode]
  );

  // The config is considered dirty (and saveable) when it differs from what is persisted.
  const isDirty = React.useMemo(() => {
    if (!config) return false;
    const current = [...shortListCodes].sort();
    const persisted = [...config.shortListCodes].sort();
    const codesChanged = current.length !== persisted.length || current.some((code, i) => code !== persisted[i]);
    const primaryChanged = (primaryCode ?? '') !== (config.primaryCode ?? '');
    return codesChanged || primaryChanged;
  }, [config, shortListCodes, primaryCode]);

  const handleSave = (): void => {
    // Persist codes in canonical order so the stored config is stable.
    const orderedCodes = BENEFIT_TYPE_CODES.filter((item) => shortListCodes.has(item.code)).map((item) => item.code);
    updateConfig.mutate({ shortListCodes: orderedCodes, primaryCode });
  };

  const handleCopyResourceId = async (): Promise<void> => {
    if (!config?.id) return;
    try {
      await navigator.clipboard.writeText(config.id);
      enqueueSnackbar('Config ID copied to clipboard', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to copy Config ID', { variant: 'error' });
    }
  };

  const renderPreviewSection = (title: string, icon: ReactElement, amount: string): ReactElement => (
    <Grid container item direction="column" spacing={1}>
      <Grid item>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
          {icon}
          <Typography variant="h6" color={theme.palette.primary.dark}>
            {title}
          </Typography>
        </Box>
      </Grid>
      {selectedBenefits.length > 0 ? (
        selectedBenefits.map((benefit) => (
          <Grid
            container
            sx={{ borderTop: `1px solid ${otherColors.lightDivider}` }}
            item
            key={benefit.code}
            direction="row"
          >
            <Grid item xs={5}>
              <Typography variant="body1" color={theme.palette.primary.dark}>
                {benefit.description}
              </Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body1" color={theme.palette.primary.dark}>
                Co-Pay
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography
                variant="body1"
                fontWeight={theme.typography.fontWeightMedium}
                color={theme.palette.text.primary}
                textAlign="right"
              >
                {amount} / {PREVIEW_PERIOD}
              </Typography>
            </Grid>
          </Grid>
        ))
      ) : (
        <Grid item>
          <Typography color="text.secondary">No copay service types selected.</Typography>
        </Grid>
      )}
    </Grid>
  );

  const renderRow = ({ code, description }: BenefitTypeCode, selected: boolean): ReactElement => (
    <TableRow key={code} hover selected={selected}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selected}
          disabled={!selected && atLimit}
          onChange={() => handleToggle(code)}
          inputProps={{ 'aria-label': `Show ${description} on short list` }}
        />
      </TableCell>
      <TableCell padding="checkbox">
        <Radio
          checked={primaryCode === code}
          disabled={!selected}
          onChange={() => handleSetPrimary(code)}
          inputProps={{ 'aria-label': `Mark ${description} as the primary copay` }}
        />
      </TableCell>
      <TableCell>{code}</TableCell>
      <TableCell>{description}</TableCell>
    </TableRow>
  );

  return (
    <Box sx={{ marginTop: 2 }}>
      <Paper sx={{ padding: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Eligibility Verification
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Select up to {MAX_SHORT_LIST_CODES} copay service types to surface on the eligibility short list, and mark one
          as Primary — its copay appears on the Payment Considerations screen.
        </Typography>

        <Grid container spacing={3} sx={{ mt: 0 }}>
          {/* Left: searchable, selected-first code table */}
          <Grid item xs={12} md={7}>
            <Alert severity="info" sx={{ mb: 2 }}>
              {shortListCodes.size} of {MAX_SHORT_LIST_CODES} selected.
            </Alert>

            <TextField
              fullWidth
              size="small"
              label="Search by code or description"
              variant="outlined"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />

            <TableContainer sx={{ maxHeight: 480 }}>
              <Table stickyHeader aria-label="Copay service type codes" size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ fontWeight: 'bold' }}>
                      Short list
                    </TableCell>
                    <TableCell padding="checkbox" sx={{ fontWeight: 'bold' }}>
                      Primary
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedRows.map((item) => renderRow(item, true))}
                  {selectedRows.length > 0 && otherRows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ p: 0, borderBottom: 'none' }}>
                        <Divider />
                      </TableCell>
                    </TableRow>
                  )}
                  {otherRows.map((item) => renderRow(item, false))}
                  {selectedRows.length === 0 && otherRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography color="text.secondary">No codes match “{searchText}”.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Right: live previews */}
          <Grid item xs={12} md={5}>
            {/* Payment Considerations preview — shows only the single primary copay */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Payment Considerations preview
            </Typography>
            <Box sx={{ backgroundColor: theme.palette.background.default, borderRadius: 1, p: 1.5 }}>
              <Typography variant="h6" color={theme.palette.primary.dark} sx={{ mb: 1 }}>
                Payment Considerations
              </Typography>
              {primaryBenefit ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  <Box sx={{ minWidth: 120 }}>
                    <Typography variant="caption" color="text.secondary">
                      Carrier
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {PREVIEW_CARRIER}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 100 }}>
                    <Typography variant="caption" color="text.secondary">
                      Copay
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {PREVIEW_IN_NETWORK_AMOUNT} / {PREVIEW_PERIOD}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {primaryBenefit.description}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography color="text.secondary">No primary copay selected.</Typography>
              )}
            </Box>

            {/* Eligibility check preview — Patient payment box */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
              Eligibility check preview
            </Typography>
            <Grid sx={{ backgroundColor: otherColors.apptHover, padding: 1 }} container spacing={2}>
              <Grid item>
                <Typography
                  variant="h5"
                  color={theme.palette.primary.dark}
                  fontWeight={theme.typography.fontWeightBold}
                >
                  Patient payment
                </Typography>
              </Grid>
              {renderPreviewSection(
                'Patient is In-Network',
                <HowToRegIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />,
                PREVIEW_IN_NETWORK_AMOUNT
              )}
              {renderPreviewSection(
                'Patient is Out-of-Network',
                <PersonRemoveIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />,
                PREVIEW_OUT_OF_NETWORK_AMOUNT
              )}
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Example only — amounts are illustrative.
            </Typography>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" onClick={handleSave} disabled={!isDirty || isLoading || updateConfig.isPending}>
            {updateConfig.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Box>

        <Divider sx={{ mt: 3, mb: 1.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Config ID:
          </Typography>
          {config?.id ? (
            <>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }} color="text.secondary">
                {config.id}
              </Typography>
              <Tooltip title="Copy Config ID">
                <IconButton size="small" onClick={handleCopyResourceId} aria-label="Copy Config ID">
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Not yet created — save the configuration to generate one.
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
