import { Box, Typography, useTheme } from '@mui/material';
import React from 'react';
import { NavLink } from 'react-router-dom';

interface BreadcrumbItem {
  text: string;
  link: string;
  isHighlighted?: boolean;
  isActive?: boolean;
}

interface BreadcrumbsViewProps {
  items: BreadcrumbItem[];
}

export const BreadcrumbsView: React.FC<BreadcrumbsViewProps> = ({ items }) => {
  const theme = useTheme();

  return (
    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
      {items.map((item, index) => {
        const color = item.isHighlighted ? theme.palette.primary.main : theme.palette.text.secondary;
        return (
          <React.Fragment key={item.text}>
            {item.isActive ? (
              <Typography variant="body1" fontWeight="bold" color={color}>
                {item.text}
              </Typography>
            ) : (
              <NavLink to={item.link} style={{ textDecoration: 'none' }}>
                <Typography variant="body1" color={color}>
                  {item.text}
                </Typography>
              </NavLink>
            )}
            {index < items.length - 1 && <Typography color={theme.palette.text.secondary}>{'>'}</Typography>}
          </React.Fragment>
        );
      })}
    </Box>
  );
};
