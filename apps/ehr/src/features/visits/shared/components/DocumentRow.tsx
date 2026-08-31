import { otherColors } from '@ehrTheme/colors';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { Card, CircularProgress, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { Link } from 'react-router-dom';
import { DeleteIconButton } from 'src/components/DeleteIconButton';

/**
 * A row is either a plain link to a document that already exists, or an action that has to produce one
 * first. Prefilled forms are the second kind: the file does not exist until the server builds it for this
 * encounter, so the row has to be able to show that it is working and that it failed.
 */
type DocumentRowProps = {
  label: string;
  onDelete?: () => void;
  disabled?: boolean;
  'data-testid'?: string;
} & ({ to: string; onClick?: never; loading?: never } | { to?: never; onClick: () => void; loading?: boolean });

export const DocumentRow: FC<DocumentRowProps> = (props) => {
  const { label, to, onClick, loading, onDelete, disabled, 'data-testid': dataTestId } = props;
  const theme = useTheme();

  // Rendered as a button rather than an anchor when there is nothing to point at yet: a link whose href
  // is not known until after a round trip cannot be opened in a new tab or copied, and offering one
  // implies both.
  const linkProps = to
    ? ({ component: Link, to, target: '_blank' } as const)
    : ({ component: 'button', type: 'button', onClick, disabled: loading || disabled } as const);

  return (
    <Card
      elevation={0}
      {...linkProps}
      sx={{
        py: 1,
        px: 2,
        backgroundColor: otherColors.apptHover,
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        color: theme.palette.primary.main,
        width: '100%',
        textDecoration: 'none',
        font: 'inherit',
        textAlign: 'left',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
      }}
    >
      {loading ? <CircularProgress size={16} /> : <InsertDriveFileOutlinedIcon fontSize="small" />}
      <Typography sx={{ flexGrow: 1 }} fontWeight={500}>
        {label}
      </Typography>
      {onDelete && (
        <DeleteIconButton
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          disabled={disabled}
          dataTestId={`${dataTestId}-delete-button`}
        />
      )}
    </Card>
  );
};
