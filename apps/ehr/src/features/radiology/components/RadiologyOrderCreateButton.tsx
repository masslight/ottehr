import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Button, ButtonGroup, ClickAwayListener, Grow, MenuItem, MenuList, Paper, Popper } from '@mui/material';
import React, { useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

// "Order Radiology" split button with the external-order dropdown. Shared by the
// radiology list page (navigates) and the Review & Sign inline flow (switches views).
export const RadiologyOrderCreateButton: React.FC<{
  onCreateOrder: () => void;
  onCreateExternalOrder: () => void;
}> = ({ onCreateOrder, onCreateExternalOrder }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <ButtonGroup
        ref={menuAnchorRef}
        variant="contained"
        sx={{ borderRadius: 28, boxShadow: 'none', '& .MuiButtonGroup-grouped': { border: 'none' } }}
      >
        <Button
          data-testid={dataTestIds.radiologyPage.orderButton}
          onClick={onCreateOrder}
          sx={{ textTransform: 'none', borderRadius: '28px 0 0 28px', fontWeight: 'bold', pl: 3 }}
        >
          Order Radiology
        </Button>
        <Button
          data-testid={dataTestIds.radiologyPage.orderMenuButton}
          size="small"
          aria-label="more radiology order options"
          aria-haspopup="menu"
          onClick={() => setMenuOpen((prev) => !prev)}
          sx={{ borderRadius: '0 28px 28px 0' }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={menuOpen} anchorEl={menuAnchorRef.current} transition placement="bottom-end" sx={{ zIndex: 1 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={() => setMenuOpen(false)}>
                <MenuList autoFocusItem={menuOpen}>
                  <MenuItem
                    data-testid={dataTestIds.radiologyPage.externalOrderMenuItem}
                    onClick={() => {
                      setMenuOpen(false);
                      onCreateExternalOrder();
                    }}
                  >
                    External Radiology Order
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
};
