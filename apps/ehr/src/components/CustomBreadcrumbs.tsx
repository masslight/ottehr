import { ReactElement } from 'react';
import { Breadcrumbs, useTheme } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';

interface ChainProps {
  link: string;
  children: ReactElement | string;
  state?: { defaultTab?: string };
}

interface CustomBreadcrumbsProps {
  chain: ChainProps[];
}

export default function CustomBreadcrumbs({ chain }: CustomBreadcrumbsProps): ReactElement {
  const location = useLocation();
  const theme = useTheme();

  return (
    <Breadcrumbs aria-label="breadcrumb" data-testid={dataTestIds.patientInformationPage.breadcrumb}>
      {chain.map((child) => {
        const link = child.link === '#' ? location.pathname + location.search : child.link;
        return (
          <Link
            key={child.link}
            style={{
              textDecoration: 'none',
              color: child.link === '#' ? 'black' : theme.palette.secondary.light,
            }}
            to={link}
            state={{ defaultTab: child.state?.defaultTab }}
          >
            {child.children}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
