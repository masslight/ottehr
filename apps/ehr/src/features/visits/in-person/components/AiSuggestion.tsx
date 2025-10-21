import { ottehrAiIcon } from '@ehrTheme/icons';
import { InfoOutlined } from '@mui/icons-material';
import { Box, Container, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { DocumentReference } from 'fhir/r4b';
import React from 'react';
import { getSource } from 'src/features/visits/shared/components/OttehrAi';
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
  const theme = useTheme();

  function getDocumentReferenceSource(
    observation: ObservationTextFieldDTO,
    documentReferences: DocumentReference[]
  ): DocumentReference | undefined {
    return documentReferences.find((document) => document.id === observation.derivedFrom?.split('/')[1]);
  }

  function SuggestionsItem(): React.ReactElement {
    return (
      <>
        {content
          ?.sort((a, b) => {
            if (!chartData?.aiChat?.documents) {
              return 0;
            }
            const documentSourceA = getDocumentReferenceSource(a, chartData.aiChat.documents);
            const documentSourceB = getDocumentReferenceSource(b, chartData.aiChat.documents);
            if (!documentSourceA || !documentSourceA.date) {
              return 0;
            }
            if (!documentSourceB || !documentSourceB.date) {
              return 0;
            }
            return new Date(documentSourceA.date).getTime() - new Date(documentSourceB.date).getTime();
          })
          .map((item) => {
            const documentSource = chartData?.aiChat?.documents
              ? getDocumentReferenceSource(item, chartData.aiChat.documents)
              : undefined;
            return (
              <Box sx={{ paddingBottom: '15px' }}>
                <Typography variant="body2" style={{ color: theme.palette.secondary.light }}>
                  {documentSource
                    ? getSource(documentSource, oystehr, chartData?.aiChat?.providers)
                    : 'source is unknown'}
                </Typography>
                <Typography variant="body1">{item.value}</Typography>
              </Box>
            );
          })}
      </>
    );
  }

  if (hideHeader) {
    return <SuggestionsItem />;
  }

  return (
    <Box sx={{ marginBottom: '10px' }}>
      <Container
        style={{
          background: '#E1F5FECC',
          borderRadius: '8px',
          padding: '4px 8px 4px 8px',
          marginBottom: '8px',
        }}
      >
        <Box style={{ display: 'flex', alignItems: 'center' }}>
          <img src={ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            Oystehr AI
          </Typography>
          <Tooltip
            placement="top"
            title="AI generated outputs, recommendations, and suggestions are provided for informational purposes only and are not intended to replace professional medical judgment or clinical expertise. AI technology may produce inaccurate, incomplete, or misleading results, and you must independently verify, validate, and confirm all AI-generated information before making any clinical decisions or taking any actions based on these outputs."
          >
            <IconButton size="small" sx={{ marginLeft: '5px' }}>
              <InfoOutlined sx={{ fontSize: '17px' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Container>
      <Container
        style={{
          background: '#E1F5FECC',
          borderRadius: '8px',
          padding: '4px 8px 4px 8px',
        }}
      >
        <Typography variant="body1" style={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <SuggestionsItem />
      </Container>
    </Box>
  );
}
