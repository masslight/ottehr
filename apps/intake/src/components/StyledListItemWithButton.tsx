import {
  Box,
  Divider,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
  useTheme,
} from '@mui/material';
import { FC } from 'react';
import { PropsWithChildren } from '../types';

type StyledListItemWithButtonProps = PropsWithChildren<{
  primaryText: string;
  secondaryText?: string;
  onClick?: () => void;
  noDivider?: boolean;
  hideText?: boolean;
}>;

export const StyledListItemWithButton: FC<StyledListItemWithButtonProps> = (props) => {
  const { children: img, primaryText, secondaryText, onClick, noDivider, hideText } = props;
  const theme = useTheme();
  const dataId = primaryText.toLowerCase().replace(/\s+/g, '-');

  return (
    <>
      <ListItem sx={{ p: 0 }}>
        <ListItemButton sx={{ p: '4px 0' }} onClick={onClick}>
          <ListItemAvatar
            sx={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ flex: hideText ? 0 : 'auto', transition: 'flex 0.5s' }}>{img}</Box>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Typography noWrap variant="subtitle1">
                {primaryText}
              </Typography>
            }
            secondary={
              <Typography fontSize="14px" color={theme.palette.text.secondary} data-testid={dataId}>
                {secondaryText}
              </Typography>
            }
            sx={{
              opacity: hideText ? '0' : '1',
              transition: 'opacity 0.5s',
            }}
          />
        </ListItemButton>
      </ListItem>
      {!noDivider && <Divider />}
    </>
  );
};
