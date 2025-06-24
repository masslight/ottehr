import { Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface BaseCrumb {
  label: string;
  path: string | null;
}

interface BaseBreadcrumbsProps {
  sectionName: string;
  baseCrumb: BaseCrumb;
  children?: ReactNode;
}

/**
 * Base breadcrumbs component that can be used to display a breadcrumb trail with a base link.
 * Can be used as regular component or as a wrapper for other components.
 *
 * Example:
 * <BaseBreadcrumbs sectionName="Patient" baseCrumb={{ label: 'Home', path: '/' }}>
 *   <PatientPage />
 * </BaseBreadcrumbs>
 *
 * Example2:
 * <Page>
 *   <BaseBreadcrumbs sectionName="Patient" baseCrumb={{ label: 'Home', path: '/' }} />
 *   <Content />
 * </Page>
 */
export const BaseBreadcrumbs: FC<BaseBreadcrumbsProps> = ({ sectionName, baseCrumb, children }) => {
  return (
    <>
      <Breadcrumbs
        separator={
          <Typography color="text.secondary" sx={{ mx: 0.5 }}>
            /
          </Typography>
        }
        sx={{ display: 'flex' }}
      >
        {baseCrumb.path ? (
          <MuiLink component={Link} to={baseCrumb.path} color="text.secondary">
            {baseCrumb.label}
          </MuiLink>
        ) : (
          <Typography color="text.secondary">{baseCrumb.label}</Typography>
        )}
        <Typography color="text.primary">{sectionName}</Typography>
      </Breadcrumbs>

      {children}
    </>
  );
};
