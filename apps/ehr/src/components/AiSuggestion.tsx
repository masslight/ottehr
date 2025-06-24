import { ottehrAiIcon } from '@ehrTheme/icons';
import { Box, Typography } from '@mui/material';
import React from 'react';

export interface AiSuggestionProps {
  title: string;
  content: string;
  hideHeader?: boolean;
}

export default function AiSuggestion({ title, content, hideHeader }: AiSuggestionProps): React.ReactElement {
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
        <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
          {title}
        </Typography>
        <Typography variant="body1">{content}</Typography>
      </Box>
    </Box>
  );
}
