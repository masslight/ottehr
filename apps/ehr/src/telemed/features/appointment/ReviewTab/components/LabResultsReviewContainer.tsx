import { FC, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { useApiClients } from '../../../../../hooks/useAppClients';
import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import { getLabOrderResults } from '../../../../../api/api';
import { GetLabOrderResultRes } from 'utils';

enum LoadingState {
  initial,
  loading,
  loaded,
  loadedWithError,
}

export const LabResultsReviewContainer: FC = () => {
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const { oystehrZambda } = useApiClients();

  const [loadingState, setLoadingState] = useState(LoadingState.initial);
  const [labOrderResults, setLabOrderResults] = useState<GetLabOrderResultRes['labOrderResults']>([]);
  console.log('labOrderResults', labOrderResults);
  const [resultsPending, setResultsPending] = useState<boolean>(false);
  console.log('check this resultsPending', resultsPending);

  useEffect(() => {
    async function getResources(oystehrZambda: Oystehr): Promise<void> {
      console.log('is the encounter empty?', encounter);
      let loadingError = false;
      setLoadingState(LoadingState.loading);
      try {
        const { labOrderResults, resultsPending: pending } = await getLabOrderResults(oystehrZambda, { encounter });
        setLabOrderResults(labOrderResults);
        setResultsPending(pending);
      } catch (e) {
        console.error('error loading resources', e);
        loadingError = true;
      } finally {
        if (loadingError) {
          setLoadingState(LoadingState.loadedWithError);
        } else {
          setLoadingState(LoadingState.loaded);
        }
      }
    }

    if (encounter?.id && oystehrZambda && loadingState === LoadingState.initial) {
      void getResources(oystehrZambda);
    }
  }, [loadingState, encounter, oystehrZambda]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Labs
      </Typography>
      {labOrderResults?.map((res) => (
        <>
          <Link to={res.url} target="_blank">
            {res.name}
          </Link>
          {res.reflexResults?.map((reflexRes) => (
            <Link style={{ marginLeft: '20px' }} key={reflexRes.url} to={reflexRes.url} target="_blank">
              + {reflexRes.name}
            </Link>
          ))}
        </>
      ))}
      {resultsPending && (
        <Typography variant="subtitle2" style={{ fontSize: '14px' }}>
          Pending Further Labs Results
        </Typography>
      )}
    </Box>
  );
};
