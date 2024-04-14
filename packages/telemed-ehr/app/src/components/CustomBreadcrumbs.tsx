import React, { ReactElement } from 'react';
import { Breadcrumbs, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';

interface ChainProps {
  link: string;
  children: ReactElement | string;
}

interface CustomBreadcrumbsProps {
  chain: ChainProps[];
}

export default function CustomBreadcrumbs({ chain }: CustomBreadcrumbsProps): ReactElement {
  const theme = useTheme();
  return (
    <Breadcrumbs aria-label="breadcrumb">
      {chain.map((child) => (
        <Link
          key={child.link}
          style={{
            textDecoration: 'none',
            color: child.link === '#' ? 'black' : theme.palette.secondary.light,
          }}
          to={child.link}
        >
          {child.children}
        </Link>
      ))}
    </Breadcrumbs>
  );
}
