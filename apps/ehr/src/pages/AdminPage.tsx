import { otherColors } from '@ehrTheme/colors';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { DEFAULT_ADMIN_PATH, resolveActiveAdminItem } from 'src/features/admin/adminNav';
import { AdminHeaderSlotProvider } from 'src/features/admin/AdminPageHeader';

const { VITE_APP_ORGANIZATION_NAME_LONG: ORGANIZATION_NAME_LONG } = import.meta.env;

export function AdminPage(): ReactElement {
  const { adminTab, billingTab, outreachSubTab, outreachDetailTab, insuranceTab } = useParams();
  const location = useLocation();
  // Portal target for each page's primary CTA, kept on the same row as the title.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);

  const activeItem = resolveActiveAdminItem({ adminTab, billingTab, outreachSubTab });

  useEffect(() => {
    if (activeItem && ORGANIZATION_NAME_LONG) {
      document.title = `${activeItem.title ?? activeItem.label} | ${ORGANIZATION_NAME_LONG} EHR`;
    }
  }, [activeItem]);

  // No tab selected (bare /admin) or an unknown tab: send the user to the default page,
  // forwarding any router state (e.g. Schedules' defaultTab passed from breadcrumbs).
  if (!activeItem) {
    return <Navigate to={DEFAULT_ADMIN_PATH} replace state={location.state} />;
  }

  return (
    <Box sx={{ p: 3, maxWidth: activeItem.centered ? '800px' : '1600px', mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          minHeight: 42,
          mb: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h3" color="primary.dark" sx={{ fontWeight: 600 }}>
            {activeItem.title ?? activeItem.label}
          </Typography>
          {activeItem.beta && (
            <Chip
              label="Beta"
              size="small"
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                height: 22,
                bgcolor: otherColors.outreachInfoBgSubtle,
                color: otherColors.outreachInfoDark,
                letterSpacing: '0.05em',
              }}
            />
          )}
        </Stack>
        <Box ref={setActionSlot} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} />
      </Box>
      <AdminHeaderSlotProvider value={actionSlot}>
        {activeItem.render({ insuranceTab, outreachDetailTab })}
      </AdminHeaderSlotProvider>
    </Box>
  );
}
