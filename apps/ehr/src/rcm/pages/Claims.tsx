import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import { Box, Card, Divider, IconButton, Paper } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClaimQueueTypes, ClaimsQueueType } from 'utils';
import { ClaimsQueueButtons, ClaimsQueueFilters, ClaimsQueueGrid } from '../features';
import { useClaimsQueueStore } from '../state';

export const Claims: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [claimType, setClaimType] = useState<ClaimsQueueType>(ClaimQueueTypes[0]);

  useEffect(() => {
    const type = searchParams.get('type') as ClaimsQueueType;

    if (!type || !ClaimQueueTypes.includes(type)) {
      setSearchParams({ type: ClaimQueueTypes[0] });
    } else {
      setClaimType(type);
    }
  }, [searchParams, setSearchParams]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Divider />

      <Card sx={{ display: 'flex', gap: 2, p: 2, backgroundColor: 'inherit', borderRadius: 0 }}>
        <ClaimsQueueFilters />

        <Box>
          <IconButton
            color="primary"
            size="small"
            onClick={() =>
              useClaimsQueueStore.setState({
                patient: undefined,
                visitId: undefined,
                teamMember: undefined,
                facilityGroup: undefined,
                facility: undefined,
                insurance: undefined,
                dosFrom: undefined,
                dosTo: undefined,
              })
            }
          >
            <FilterAltOffOutlinedIcon />
          </IconButton>
        </Box>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: 'column', p: 3, gap: 2 }}>
        <ClaimsQueueButtons />

        <Paper>
          <ClaimsQueueGrid type={claimType} />
        </Paper>
      </Box>
    </Box>
  );
};
