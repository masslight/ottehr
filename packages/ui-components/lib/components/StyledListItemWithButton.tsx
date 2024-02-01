import { FC } from 'react';
import { ListItem, ListItemAvatar, ListItemButton, ListItemText, Typography, useTheme, Divider } from '@mui/material';
import { PropsWithChildren } from '../types';

export const StyledListItemWithButton: FC<
  PropsWithChildren<{ primaryText: string; secondaryText?: string; onClick?: () => void; noDivider?: boolean }>
> = (props) => {
  const { children: img, primaryText, secondaryText, onClick, noDivider } = props;
  const theme = useTheme();

  return (
    <>
      <ListItem sx={{ p: 0 }}>
        <ListItemButton sx={{ p: '4px 0' }} onClick={onClick}>
          <ListItemAvatar>{img}</ListItemAvatar>
          <ListItemText
            primary={<Typography variant="subtitle1">{primaryText}</Typography>}
            secondary={
              <Typography variant="body2" color={theme.palette.text.secondary}>
                {secondaryText}
              </Typography>
            }
          />
        </ListItemButton>
      </ListItem>
      {!noDivider && <Divider />}
    </>
  );
};
