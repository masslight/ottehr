import { WarningAmberOutlined } from '@mui/icons-material';
import CheckIcon from '@mui/icons-material/Check';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { Box, Typography } from '@mui/material';
import { FC, Fragment, ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ExternalLabOrderResult, InHouseLabResult, LabType, NonNormalResult } from 'utils';

interface LabResultsReviewContainerProps {
  resultDetails:
    | {
        type: LabType.external;
        results: ExternalLabOrderResult[];
      }
    | {
        type: LabType.inHouse;
        results: InHouseLabResult[];
      };
  resultsPending: boolean;
}

export const LabResultsReviewContainer: FC<LabResultsReviewContainerProps> = ({ resultDetails, resultsPending }) => {
  const isExternal = resultDetails.type === LabType.external;
  const title = isExternal ? 'External Labs' : 'In-House Labs';
  const keyIdentifier = isExternal ? 'external-lab-result' : 'in-house-lab-result';

  const checkForAbnormalResultFlag = (result: ExternalLabOrderResult | InHouseLabResult): ReactElement | null => {
    const flags = result.nonNormalResultContained?.map((nonNormalFlag) => {
      switch (nonNormalFlag) {
        case NonNormalResult.Abnormal:
          return (
            <>
              <WarningAmberOutlined sx={{ ml: '8px' }} color="warning" />
              <Typography color="warning.main" sx={{ ml: '4px' }}>
                Abnormal Result
              </Typography>
            </>
          );
        case NonNormalResult.Inconclusive:
          return (
            <>
              <QuestionMarkIcon sx={{ ml: '8px' }} color="disabled" />
              <Typography color="text.disabled" sx={{ ml: '4px' }}>
                Inconclusive Result
              </Typography>
            </>
          );
        case NonNormalResult.Neutral:
          return <></>;
      }
    });
    if (flags) {
      return <>{flags}</>;
    } else if (isExternal) {
      // we cannot assume if no flags the result is normal since the logic to flag abnormal / inconclusive at a high level is murky for external labs
      return null;
    } else {
      return (
        <>
          <CheckIcon sx={{ ml: '8px' }} color="success" />
          <Typography color="success.main" sx={{ ml: '4px' }}>
            Normal Result
          </Typography>
        </>
      );
    }
  };

  return (
    <Box
      data-testid={dataTestIds.progressNotePage.labsTitle(title)}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
    >
      <Typography variant="h5" color="primary.dark">
        {title}
      </Typography>
      {resultDetails.results?.map((res, idx) => (
        <Fragment key={`${keyIdentifier}-${idx}`}>
          <Box sx={{ display: 'flex', alignItems: 'end' }}>
            <Link to={res.url} target="_blank">
              {res.name}
            </Link>
            {checkForAbnormalResultFlag(res)}
          </Box>
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
