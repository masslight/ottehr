import { FC, Fragment } from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const LabResultsReviewContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['encounter', 'chartData']);

  const labResultFromChart = chartData?.labResults;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Labs
      </Typography>
      {labResultFromChart?.labOrderResults?.map((res, idx) => (
        <Fragment key={`${idx}-${res.orderNumber}`}>
          <Link to={res.url} target="_blank">
            {res.name}
          </Link>
          {res.reflexResults?.map((reflexRes, reflexIdx) => (
            <Link
              key={`${idx}-${reflexIdx}-${reflexRes.name}`}
              style={{ marginLeft: '20px' }}
              to={reflexRes.url}
              target="_blank"
            >
              + {reflexRes.name}
            </Link>
          ))}
        </Fragment>
      ))}
      {labResultFromChart?.resultsPending && (
        <Typography variant="subtitle2" style={{ fontSize: '14px' }}>
          Lab Results Pending
        </Typography>
      )}
    </Box>
  );
};
