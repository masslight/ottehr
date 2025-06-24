import { otherColors } from '@ehrTheme/colors';
import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { FC, ReactNode } from 'react';
import { PropsWithChildren } from '../../shared/types';

type AccordionCardProps = PropsWithChildren<{
  collapsed?: boolean;
  onSwitch?: () => void;
  label?: string | ReactNode;
  headerItem?: ReactNode;
  withBorder?: boolean;
  dataTestId?: string;
}>;

export const AccordionCard: FC<AccordionCardProps> = (props) => {
  const { collapsed, onSwitch, label, children, headerItem, dataTestId, withBorder = true } = props;

  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        backgroundColor: otherColors.solidLine,
        border: withBorder ? `1px solid ${otherColors.solidLine}` : 'none',
        borderRadius: 1,
      }}
      data-testid={dataTestId}
    >
      {label && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: otherColors.apptHover,
            py: 0.5,
            px: 2,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexGrow: 1,
              cursor: collapsed !== undefined ? 'pointer' : 'inherit',
            }}
            onClick={onSwitch}
          >
            {collapsed !== undefined && onSwitch && (
              <IconButton sx={{ p: 0 }}>
                <ArrowDropDownCircleOutlinedIcon
                  fontSize="small"
                  sx={{
                    color: theme.palette.primary.main,
                    rotate: collapsed ? '' : '180deg',
                  }}
                ></ArrowDropDownCircleOutlinedIcon>
              </IconButton>
            )}
            {typeof label === 'string' ? (
              <Typography variant="h6" color={theme.palette.primary.dark}>
                {label}
              </Typography>
            ) : (
              label
            )}
          </Box>

          {headerItem}
        </Box>
      )}
      {!collapsed && (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            borderRadius: label ? undefined : 1,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
};
