import { AppBar, Toolbar, Typography } from '@mui/material';
import { FC } from 'react';
import { Link } from 'react-router-dom';
import { otherColors } from '../../themes/ottehr/colors';

export const Navbar: FC = () => (
  <AppBar
    position="sticky"
    elevation={0}
    sx={{
      bgcolor: 'background.paper',
      borderBottom: `1px solid ${otherColors.lightDivider}`,
      zIndex: (t) => t.zIndex.drawer + 1,
    }}
  >
    <Toolbar variant="dense" sx={{ px: 2 }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.dark', letterSpacing: '-0.02em' }}>
          Ottehr Billing
        </Typography>
      </Link>
    </Toolbar>
  </AppBar>
);
