import { aiIcon } from '@ehrTheme/icons';
import { InfoOutlined } from '@mui/icons-material';
import { Box, Grid, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { FC } from 'react';
import { CPTCodeDTO } from 'utils';
import { useAiSuggestionsStore } from '../../stores/ai-suggestions.store';
import { useChartData } from '../../stores/appointment/appointment.store';
import { useAddCptCode } from './BillingCodesContainer';

export const AiCptSuggestionsInline: FC = () => {
  const { chartData } = useChartData();
  const currentCptCodes: CPTCodeDTO[] = [];
  if (chartData?.cptCodes) {
    currentCptCodes.push(...chartData.cptCodes);
  }
  if (chartData?.emCode) {
    currentCptCodes.push(chartData.emCode);
  }

  const cptCodes = useAiSuggestionsStore((state) => state.cptSuggestions);
  const { onAdd: onAddCptCode } = useAddCptCode();

  const cptCodesSuggest = cptCodes?.filter((code) => !currentCptCodes.some((cptCode) => cptCode.code === code.code));

  if (!cptCodesSuggest || cptCodesSuggest.length === 0) {
    return null;
  }

  const addCptCode = (cptCode: { code: string; description: string }): void => {
    onAddCptCode({ code: cptCode.code, display: cptCode.description });
  };

  return (
    <Box
      sx={{
        background: '#E1F5FECC',
        borderRadius: '8px',
        padding: '8px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <img src={aiIcon} style={{ width: '20px' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '12px' }}>
          OYSTEHR AI
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        CPT Codes
      </Typography>
      <ul style={{ margin: 0, paddingLeft: '16px' }}>
        {cptCodesSuggest.map((cptCode) => (
          <li key={cptCode.code} style={{ marginBottom: '2px' }}>
            <Grid container alignItems="center">
              <Grid item sx={{ cursor: 'pointer' }}>
                <Link onClick={() => addCptCode(cptCode)}>
                  <Typography variant="body2">
                    {cptCode.code}: {cptCode.description}
                  </Typography>
                </Link>
              </Grid>
              <Grid item>
                <Tooltip title={cptCode.reason}>
                  <IconButton size="small">
                    <InfoOutlined sx={{ fontSize: '15px' }} />
                  </IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          </li>
        ))}
      </ul>
    </Box>
  );
};
