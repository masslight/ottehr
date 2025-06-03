import { Breadcrumbs, Typography, Link } from '@mui/material';
import { getInHouseLabsUrl } from 'src/features/css-module/routing/helpers';
import { useAppointmentStore } from 'src/telemed';

export const WithInHouseLabsBreadcrums: React.FC<{ children: React.ReactNode; pageName: string }> = ({
  children,
  pageName,
}) => {
  const appointmentId = useAppointmentStore((state) => state.appointment?.id);

  if (!appointmentId) {
    return null;
  }

  return (
    <>
      <Breadcrumbs
        separator={<Typography sx={{ color: '#5F6368', mx: 0.5 }}>/</Typography>}
        sx={{ display: 'flex', mb: '18px !important' }}
      >
        <Link
          underline="hover"
          color="inherit"
          href={getInHouseLabsUrl(appointmentId || '')}
          sx={{
            color: '#000000DE',
            textDecoration: 'underline',
            '&:hover': { color: '#1A73E8' },
          }}
        >
          In-House Labs
        </Link>
        <Typography
          sx={{
            color: '#202124',
          }}
        >
          {pageName}
        </Typography>
      </Breadcrumbs>
      {children}
    </>
  );
};
