import { CircularProgress, FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { useGetUnsolicitedResultsRelatedRequests } from 'src/telemed';
import { UnsolicitedResultsRequestType } from 'utils';

interface UnsolicitedVisitMatchCardProps {
  diagnosticReportId: string;
  patientId: string;
  srIdForConfirmedMatchedVisit: string;
  setSrIdForConfirmedMatchedVisit: (serviceRequestId: string) => void;
}

export const UnsolicitedVisitMatchCard: FC<UnsolicitedVisitMatchCardProps> = ({
  diagnosticReportId,
  patientId,
  srIdForConfirmedMatchedVisit,
  setSrIdForConfirmedMatchedVisit,
}) => {
  const {
    data,
    error: resourceSearchError,
    isLoading,
  } = useGetUnsolicitedResultsRelatedRequests({
    requestType: UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_RELATED_REQUESTS,
    diagnosticReportId,
    patientId,
  });

  console.log('resourceSearchError', resourceSearchError);

  const handleChange = (serviceRequestId: string): void => {
    setSrIdForConfirmedMatchedVisit(serviceRequestId);
  };
  return (
    <>
      {isLoading ? (
        <CircularProgress />
      ) : (
        <FormControl>
          <RadioGroup row value={srIdForConfirmedMatchedVisit ?? ''} onChange={(e) => handleChange(e.target.value)}>
            <FormControlLabel key={`visit-date-radio-none-val`} value="" control={<Radio />} label="none" />
            {data?.possibleRelatedSRsWithVisitDate?.map((info, index) => (
              <FormControlLabel
                key={`visit-date-radio-${index}`}
                value={info.serviceRequestId}
                control={<Radio />}
                label={DateTime.fromISO(info.visitDate).toFormat('MM/dd/yyyy')}
              />
            ))}
          </RadioGroup>
        </FormControl>
      )}
    </>
  );
};
