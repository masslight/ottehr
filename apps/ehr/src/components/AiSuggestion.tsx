import { ottehrAiIcon } from '@ehrTheme/icons';
import { Box, Typography } from '@mui/material';
import React from 'react';
import { getSource } from 'src/features/css-module/pages/OttehrAi';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetChartDataResponse, ObservationTextFieldDTO } from 'utils';

export interface AiSuggestionProps {
  title: string;
  chartData: GetChartDataResponse | undefined;
  content: ObservationTextFieldDTO[];
  hideHeader?: boolean;
}

export default function AiSuggestion({ title, chartData, content, hideHeader }: AiSuggestionProps): React.ReactElement {
  const { oystehr } = useApiClients();
  return (
    <Box>
      {hideHeader !== true ? (
        <Box
          style={{
            display: 'flex',
            background: '#FFF9EF',
            borderRadius: '8px',
            padding: '4px 8px 4px 8px',
            marginBottom: '8px',
            alignItems: 'center',
          }}
        >
          <img src={ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            OYSTEHR AI
          </Typography>
        </Box>
      ) : undefined}
      <Box
        style={{
          background: '#FFF9EF',
          borderRadius: '8px',
          padding: '8px',
        }}
      >
        <Typography variant="body1" style={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {content?.map((item) => {
          const documentReference = chartData?.aiChat?.documents.find(
            (document) => document.id === item.derivedFrom?.split('/')[1]
          );
          return (
            <Box sx={{ paddingBottom: 5 }}>
              <Typography variant="body2" style={{ fontWeight: 700 }}>
                source:{' '}
                {documentReference ? getSource(documentReference, oystehr, chartData?.aiChat?.providers) : 'unknown'}
              </Typography>
              <Typography variant="body1">{item.value}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
