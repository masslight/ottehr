import { ReactElement } from 'react';
import { Tooltip, Typography } from '@mui/material';
import { Favorite, Refresh } from '@mui/icons-material';

export default function Loading(): ReactElement {
  return (
    <Tooltip
      title={
        <>
          Made with
          <Favorite fontSize="small" htmlColor="red" sx={{ verticalAlign: 'top' }} /> by MassLight
        </>
      }
      placement="top"
    >
      <Typography
        variant="subtitle2"
        sx={{
          // color: 'rgba(0, 0, 0, 0.7)',
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: 'auto',
          marginRight: 5,
          animation: 'color-update 10s linear infinite',
          '@keyframes color-update': {
            '0%': {
              color: 'red',
            },
            '50%': {
              color: 'blue',
            },
            '100%': {
              color: 'red',
            },
          },
          '& #loading-dot-1': {
            animation: 'loading-1 1s linear alternate infinite',
          },
          '& #loading-dot-2': {
            animation: 'loading-2 1s linear alternate infinite',
          },
          '& #loading-dot-3': {
            animation: 'loading-3 1s linear alternate infinite',
          },
          '@keyframes loading-1': {
            '75%': {
              opacity: 0,
            },
            '100%': {
              opacity: 0,
            },
          },
          '@keyframes loading-2': {
            '50%': {
              opacity: 0,
            },
            '100%': {
              opacity: 0,
            },
          },
          '@keyframes loading-3': {
            '25%': {
              opacity: 0,
            },
            '100%': {
              opacity: 0,
            },
          },
        }}
      >
        refreshing
        <span className="loading-dot" id="loading-dot-1">
          .
        </span>
        <span className="loading-dot" id="loading-dot-2">
          .
        </span>
        <span className="loading-dot" id="loading-dot-3">
          .
        </span>
        <Refresh
          sx={{
            marginLeft: 1,
            animation: 'spin-animation 1s linear infinite',
            '@keyframes spin-animation': {
              '0%': {
                transform: 'rotate(0)',
              },
              '100%': {
                transform: 'rotate(360deg)',
              },
            },
          }}
        />
      </Typography>
    </Tooltip>
  );
}
