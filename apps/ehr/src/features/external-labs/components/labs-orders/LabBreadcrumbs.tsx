import { Link } from 'react-router-dom';
import { Box, Typography, Link as MuiLink, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC } from 'react';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { AUTO_REDIRECTED_PARAM } from 'utils/lib/types/data/labs/labs.constants';

interface LabBreadcrumbsProps {
  sectionName: string;
  disableLabsLink?: boolean;
  children: React.ReactNode;
}

const PageWrapper = styled(Box)({
  padding: '16px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
});

const BreadcrumbsContainer = styled(Box)({
  display: 'flex',
  gap: '8px',
  alignSelf: 'flex-start',
  marginLeft: '42px',
});

const Separator = styled(Typography)({
  color: '#666',
});

export const WithLabBreadcrumbs: FC<LabBreadcrumbsProps> = ({ sectionName, disableLabsLink = false, children }) => {
  const { appointment } = getSelectors(useAppointmentStore, ['appointment']);
  const searchParams = new URLSearchParams(location.search);
  const isAutoRedirected = searchParams.has(AUTO_REDIRECTED_PARAM);

  /**
   * If there are no lab orders, a redirect will be triggered to create a new lab order.
   * In that case, we should not render the breadcrumbs because if the user goes back
   * to lab orders, they will be redirected again and might think something is broken.
   */
  if (isAutoRedirected) {
    return (
      <>
        <Alert severity="info" sx={{ mx: '20px' }}>
          No orders have been created yet.
        </Alert>
        {children}
      </>
    );
  }

  return (
    <PageWrapper>
      <BreadcrumbsContainer>
        {!disableLabsLink && appointment?.id ? (
          <MuiLink component={Link} to={`/in-person/${appointment.id}/external-lab-orders`} color="text.primary">
            Labs
          </MuiLink>
        ) : (
          <Typography color="text.primary">Labs</Typography>
        )}
        <Separator>/</Separator>
        <Typography color="text.primary">{sectionName}</Typography>
      </BreadcrumbsContainer>

      {children}
    </PageWrapper>
  );
};
