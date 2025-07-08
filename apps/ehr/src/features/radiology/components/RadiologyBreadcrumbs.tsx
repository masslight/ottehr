import { Box, Link as MuiLink, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC } from 'react';
import { Link } from 'react-router-dom';
import { getRadiologyUrl } from 'src/features/css-module/routing/helpers';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';

interface RadiologyBreadcrumbsProps {
  sectionName: string;
  disableLabsLink?: boolean;
  children: React.ReactNode;
}

const PageWrapper = styled(Box)({
  padding: '0px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
});

const BreadcrumbsContainer = styled(Box)({
  display: 'flex',
  gap: '8px',
  alignSelf: 'flex-start',
  marginLeft: '0px',
});

const Separator = styled(Typography)({
  color: '#666',
});

export const WithRadiologyBreadcrumbs: FC<RadiologyBreadcrumbsProps> = ({
  sectionName,
  disableLabsLink = false,
  children,
}) => {
  const { appointment } = getSelectors(useAppointmentStore, ['appointment']);

  return (
    <PageWrapper>
      <BreadcrumbsContainer>
        {!disableLabsLink && appointment?.id ? (
          <MuiLink component={Link} to={getRadiologyUrl(appointment.id)} color="text.primary">
            Radiology
          </MuiLink>
        ) : (
          <Typography color="text.primary">Radiology</Typography>
        )}
        <Separator>/</Separator>
        <Typography color="text.primary">{sectionName}</Typography>
      </BreadcrumbsContainer>

      {children}
    </PageWrapper>
  );
};
