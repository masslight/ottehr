import { FC } from 'react';
import {
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
  useTheme,
  Divider,
  Box,
} from '@mui/material';
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
              <Typography noWrap fontSize="14px" color={theme.palette.text.secondary}>
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
