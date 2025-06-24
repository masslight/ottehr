import MenuIcon from '@mui/icons-material/Menu';
import { Box, IconButton, Menu, MenuItem, useTheme } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppTab, useNavStore } from '../../state/nav.store';
import { NavbarItems } from './Navbar';

interface MobileMenuProps {
  navbarItems: NavbarItems;
}

export default function MobileMenu({ navbarItems }: MobileMenuProps): ReactElement {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MenuIcon fontSize="large" sx={{ color: theme.palette.primary.main }}></MenuIcon>
      </IconButton>
      <Menu
        id="mobile-menu"
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
      >
        {(Object.keys(navbarItems) as AppTab[]).map((navbarItem) => (
          <MenuItem
            key={navbarItem}
            onClick={() => {
              useNavStore.setState({ currentTab: navbarItem });
              navigate(navbarItems[navbarItem]!.urls?.[0]);
              setAnchorEl(null);
            }}
          >
            {navbarItem}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
