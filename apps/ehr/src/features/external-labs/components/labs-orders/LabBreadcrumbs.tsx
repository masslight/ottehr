import { Link } from 'react-router-dom';
import { Box, Typography, Link as MuiLink } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC } from 'react';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';

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
