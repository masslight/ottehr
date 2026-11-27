import { Link } from '@mui/material';
import { ReactElement } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { VisitColumn } from '../format';

export const VisitLink = ({ visit }: { visit: VisitColumn }): ReactElement =>
  visit.url ? (
    <Link component={RouterLink} to={visit.url}>
      {visit.label}
    </Link>
  ) : (
    <>{visit.label}</>
  );
