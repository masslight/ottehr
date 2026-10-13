import { Box } from '@mui/material';
import React from 'react';

/** A unified diff, coloured by line. */
export function DiffView({ patch }: { patch: string }): React.ReactElement {
  const lines = patch.split('\n').slice(4); // drop the ---/+++ header
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1,
        fontSize: 11.5,
        lineHeight: 1.45,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        bgcolor: '#fafbfc',
        borderRadius: 1,
        overflow: 'auto',
        maxHeight: 320,
        border: '1px solid #e6e9ef',
      }}
    >
      {lines.map((line, i) => {
        const color = line.startsWith('+')
          ? '#0a6b2d'
          : line.startsWith('-')
          ? '#a1301b'
          : line.startsWith('@@')
          ? '#5a6578'
          : undefined;
        const bg = line.startsWith('+') ? '#e9f7ee' : line.startsWith('-') ? '#fbe9e6' : undefined;
        return (
          <Box
            key={i}
            component="span"
            sx={{ display: 'block', color, bgcolor: bg, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {line || ' '}
          </Box>
        );
      })}
    </Box>
  );
}
