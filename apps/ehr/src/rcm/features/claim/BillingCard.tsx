import { otherColors } from '@ehrTheme/colors';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { FC } from 'react';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useClaimStore } from '../../state';
import { ClaimCard } from './ClaimCard';
import { BillingModal } from './modals';

export const BillingCard: FC = () => {
  const { organizations, facilities, claimData, coverageData } = getSelectors(useClaimStore, [
    'organizations',
    'facilities',
    'claimData',
    'coverageData',
  ]);

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const provider = organizations?.find((organization) => organization.id === coverageData?.organizationId)?.name || '';
  const facility = facilities?.find((facility) => facility.id === claimData?.facilityId)?.name || '';

  return (
    <ClaimCard title="24. Billing" editButton={<BillingModal />}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {claimData?.billingItems && claimData.billingItems?.length > 0 && (
          <Table
            sx={{
              '& .MuiTableCell-head': {
                fontWeight: 500,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>A. Date</TableCell>
                <TableCell>B. Place</TableCell>
                {/* cSpell:disable-next Emerg-(enc)y */}
                <TableCell>C. Emerg-y</TableCell>
                <TableCell>D. Code & Modifiers</TableCell>
                {/* cSpell:disable-next Diagn.(ostic) */}
                <TableCell>E. Diagn. pointers</TableCell>
                <TableCell>F. Charges, $</TableCell>
                <TableCell>G. Units / Days</TableCell>
                <TableCell>H. EPSDT</TableCell>
                <TableCell>J. Rendering Provider ID </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claimData.billingItems.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {item.date?.[0]?.toFormat('MM.dd.yyyy')} - {item.date?.[1]?.toFormat('MM.dd.yyyy')}
                  </TableCell>
                  <TableCell>{facility}</TableCell>
                  <TableCell>{item.emergency ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <Typography>{item.code}</Typography>
                    <Typography>{item.modifiers}</Typography>
                  </TableCell>
                  <TableCell>
                    {/*{item.pointerA && <Typography>A</Typography>}*/}
                    {/*{item.pointerB && <Typography>B</Typography>}*/}
                  </TableCell>
                  <TableCell>{item.charges}</TableCell>
                  <TableCell>{item.units}</TableCell>
                  <TableCell></TableCell>
                  <TableCell>{provider}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '500px' }}>
          <Card
            elevation={0}
            sx={{
              backgroundColor: otherColors.lightIconButton,
              px: 2,
              py: '10px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h5" color="primary.dark">
              28. Total charge:
            </Typography>
            <Typography variant="h5" color="primary.main">
              {typeof claimData?.totalCharge === 'number' ? currencyFormatter.format(claimData.totalCharge) : '-'}
            </Typography>
          </Card>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Typography color="primary.dark">29.Patient Payment</Typography>
            <Typography>
              {typeof claimData?.patientPaid === 'number' ? currencyFormatter.format(claimData.patientPaid) : '-'}
            </Typography>
          </Box>

          {/*<Divider flexItem />*/}

          {/*<Box*/}
          {/*  sx={{*/}
          {/*    display: 'flex',*/}
          {/*    justifyContent: 'space-between',*/}
          {/*  }}*/}
          {/*>*/}
          {/*  <Typography color="primary.dark">30.Reserved for NUCC use</Typography>*/}
          {/*  <Typography>TODO</Typography>*/}
          {/*</Box>*/}
        </Box>
      </Box>
    </ClaimCard>
  );
};
