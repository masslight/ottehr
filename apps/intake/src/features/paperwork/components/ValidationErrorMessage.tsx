import { FC } from 'react';
import { Grid, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import i18n from '../../../lib/i18n';
import { FormValidationErrorObject } from '../helpers';

interface ValidationErrorMessageProps {
  errorObejct: FormValidationErrorObject;
  links: { [pageId: string]: { path: string; pageName: string } };
}

const ValidationErrorMessageContent: FC<ValidationErrorMessageProps> = ({ errorObejct, links }) => {
  return (
    <Grid container direction={'column'}>
      <Grid item>
        <Typography variant="caption">{i18n.t('paperworkPages.correctErrors')}</Typography>
      </Grid>
      {Object.entries(errorObejct).map((entry) => {
        const [pageId, errorList] = entry;
        return (
          <Grid item container direction={'column'}>
            <Grid item>
              <Link to={links[pageId]?.path ?? ''}>{links[pageId]?.pageName ?? ''}</Link>
            </Grid>
            <Grid item>
              <Typography>{`- ${errorList.join(', ')}`}</Typography>
            </Grid>
          </Grid>
        );
      })}
    </Grid>
  );
};

export default ValidationErrorMessageContent;
