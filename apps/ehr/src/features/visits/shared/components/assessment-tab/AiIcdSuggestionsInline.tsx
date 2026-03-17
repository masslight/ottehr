import { aiIcon } from '@ehrTheme/icons';
import { InfoOutlined } from '@mui/icons-material';
import { Box, Grid, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { FC } from 'react';
import { DiagnosisDTO } from 'utils';
import { useAiSuggestionsStore } from '../../stores/ai-suggestions.store';
import { useChartData } from '../../stores/appointment/appointment.store';
import { useAddDiagnosis } from './DiagnosesContainer';

export const AiIcdSuggestionsInline: FC = () => {
  const { chartData } = useChartData();
  const currentDiagnoses: DiagnosisDTO[] | undefined = chartData?.diagnosis;
  const icdCodes = useAiSuggestionsStore((state) => state.icdSuggestions);

  const { onAdd: onAddDiagnosis } = useAddDiagnosis();

  const icdCodesSuggest = icdCodes?.filter(
    (code) => !currentDiagnoses?.some((diagnosis) => diagnosis.code === code.code)
  );

  if (!icdCodesSuggest || icdCodesSuggest.length === 0) {
    return null;
  }

  const addIcdCode = (icdCode: { code: string; description: string }): void => {
    onAddDiagnosis({ code: icdCode.code, display: icdCode.description });
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
        Potential Diagnoses
      </Typography>
      <ul style={{ margin: 0, paddingLeft: '16px' }}>
        {icdCodesSuggest.map((icdCode) => (
          <li key={icdCode.code} style={{ marginBottom: '2px' }}>
            <Grid container alignItems="center">
              <Grid item sx={{ cursor: 'pointer' }}>
                <Link onClick={() => addIcdCode(icdCode)}>
                  <Typography variant="body2">
                    {icdCode.code}: {icdCode.description}
                  </Typography>
                </Link>
              </Grid>
              <Grid item>
                <Tooltip title={icdCode.reason}>
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
