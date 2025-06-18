import { FC, Fragment } from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { InHouseLabResult, ExternalLabOrderResult, LabType } from 'utils';

interface LabResultsReviewContainerProps {
  resultDetails:
    | {
        type: LabType.external;
        results: ExternalLabOrderResult[];
      }
    | {
        type: LabType.inhouse;
        results: InHouseLabResult[];
      };
  resultsPending: boolean;
}

export const LabResultsReviewContainer: FC<LabResultsReviewContainerProps> = ({ resultDetails, resultsPending }) => {
  const isExternal = resultDetails.type === LabType.external;
  const title = isExternal ? 'External Labs' : 'In-House Labs';
  const keyIdentifier = isExternal ? 'external-lab-result' : 'inhouse-lab-result';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        {title}
      </Typography>
      {resultDetails.results?.map((res, idx) => (
        <Fragment key={`${keyIdentifier}-${idx}`}>
          <Link to={res.url} target="_blank">
            {res.name}
          </Link>
          {isExternal &&
            'reflexResults' in res &&
            res?.reflexResults?.map((reflexRes, reflexIdx) => (
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
      {resultsPending && (
        <Typography variant="subtitle2" style={{ fontSize: '14px' }}>
          Lab Results Pending
        </Typography>
      )}
    </Box>
  );
};
