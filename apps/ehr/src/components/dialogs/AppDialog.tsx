import { otherColors } from '@ehrTheme/colors';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  DialogTitle,
  IconButton,
  SxProps,
  Theme,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FormEventHandler, ReactElement, ReactNode } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

/**
 * The one dialog shell for the EHR. It standardizes the top of a dialog (title, subtitle, icon, ✕),
 * the bottom (button order, shape and color) and the surface (width, radius, close behavior).
 * Everything in between is the caller's: pass it as `children`.
 *
 * - `confirm`, `destructive` and `alert` are always XS (444px).
 * - `form` covers everything else — forms, pickers, viewers — and the caller picks the size.
 */
export type AppDialogSize = 'xs' | 's' | 'm' | 'l' | 'full';

export interface AppDialogPrimary {
  /** A verb, in Title Case: "Save", "Delete Note". Never "OK" or "Yes". */
  label: string;
  /** Omit when the dialog has `onSubmit`: the primary button then submits the form. */
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

export interface AppDialogDismiss {
  /** Defaults to "Cancel" ("Back" for an alert the user can proceed past). */
  label?: string;
  /** Defaults to `onClose`. */
  onClick?: () => void;
  'data-testid'?: string;
}

export interface AppDialogAction {
  label: string;
  onClick: () => void;
  /** `error` for a destructive secondary action, such as Delete in an edit form. */
  tone?: 'error';
  loading?: boolean;
  disabled?: boolean;
  startIcon?: ReactNode;
  'data-testid'?: string;
}

interface AppDialogCommonProps {
  open: boolean;
  /** Called by ✕, Esc, a backdrop click and the dismiss button. Decide here whether to really close. */
  onClose: () => void;
  /** Title Case. */
  title: string;
  children?: ReactNode;
  /** Blocks ✕, Esc, backdrop and dismiss. Implied while `primary` or any action is loading. */
  busy?: boolean;
  'data-testid'?: string;
}

interface AppDialogConfirmProps extends AppDialogCommonProps {
  variant: 'confirm' | 'destructive';
  primary: AppDialogPrimary;
  dismiss?: AppDialogDismiss;
}

interface AppDialogAlertProps extends AppDialogCommonProps {
  variant: 'alert';
  /** `warning` (amber, the default) for a risk; `error` (red) for a failure. */
  severity?: 'warning' | 'error';
  /**
   * The way to proceed despite the alert ("Continue Anyway"). Leave it out for an alert that only
   * informs: the footer is then a single filled Close button.
   */
  primary?: AppDialogPrimary;
  dismiss?: AppDialogDismiss;
}

interface AppDialogFormProps extends AppDialogCommonProps {
  variant: 'form';
  size: AppDialogSize;
  /** One line under the title, sentence case. */
  subtitle?: string;
  /** With none of `primary`, `actions` and `dismiss`, the dialog has no footer: ✕ is enough to close it. */
  primary?: AppDialogPrimary;
  dismiss?: AppDialogDismiss;
  /** Outlined buttons on the right, before the primary: Download, Save Draft, Delete. */
  actions?: AppDialogAction[];
  /** Short text beside the right-hand buttons, such as "2 selected". */
  footerNote?: ReactNode;
  /** Makes the dialog a `<form>`; the primary button submits it. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  /** For content that must reach the dialog's edges (a document preview, a full-width table). */
  disableContentPadding?: boolean;
}

export type AppDialogProps = AppDialogConfirmProps | AppDialogAlertProps | AppDialogFormProps;

const MAX_WIDTH: Record<Exclude<AppDialogSize, 'full'>, DialogProps['maxWidth']> = {
  xs: 'xs', // 444px
  s: 'sm', // 600px
  m: 'md', // 900px
  l: 'lg', // 1200px
};

// Tinted discs behind the title icon; the same tints MUI's standard Alert uses.
const ICON_TINT = { error: '#fdeded', warning: '#fff4e5' } as const;

// The dialog standard's amber (#ED6C02) is deeper than the theme's `warning.main`, so that white
// button text stays readable on it.
const WARNING = otherColors.warningIcon;
const warningButtonSx: SxProps<Theme> = {
  bgcolor: WARNING,
  color: '#fff',
  '&:hover': { bgcolor: '#C55A02' },
};

const buttonSx: SxProps<Theme> = {
  height: 32,
  minWidth: 64,
  px: 2,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

export function AppDialog(props: AppDialogProps): ReactElement {
  const { open, onClose, title, children, variant } = props;
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));

  const size: AppDialogSize = props.variant === 'form' ? props.size : 'xs';
  const subtitle = props.variant === 'form' ? props.subtitle : undefined;
  const actions = props.variant === 'form' ? props.actions ?? [] : [];
  const footerNote = props.variant === 'form' ? props.footerNote : undefined;
  const onSubmit = props.variant === 'form' ? props.onSubmit : undefined;
  const disableContentPadding = props.variant === 'form' && props.disableContentPadding;
  const { primary, dismiss } = props;

  const tone: 'error' | 'warning' | undefined =
    variant === 'destructive' ? 'error' : variant === 'alert' ? props.severity ?? 'warning' : undefined;
  const primaryIsWarning = variant === 'alert' && Boolean(primary);

  const busy = Boolean(props.busy || primary?.loading || actions.some((action) => action.loading));
  const handleClose = (): void => {
    if (!busy) onClose();
  };

  // An alert with nothing to decide gets a single filled Close; a form with no buttons gets no footer.
  const informationOnly = variant === 'alert' && !primary;
  const hasFooter = variant !== 'form' || Boolean(primary || dismiss || actions.length);
  const dismissLabel = dismiss?.label ?? (variant === 'alert' ? 'Back' : 'Cancel');

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth={size === 'full' ? false : MAX_WIDTH[size]}
      fullScreen={size === 'full' || (isNarrow && size === 'l')}
      disableScrollLock
      data-testid={props['data-testid']}
      PaperProps={{
        ...(onSubmit ? { component: 'form', onSubmit, noValidate: true } : {}),
        sx: {
          borderRadius: size === 'full' ? 0 : '4px',
          p: 0,
          // Below 600px of screen every size fills the screen minus a 16px margin.
          [theme.breakpoints.down('sm')]:
            size === 'full' || size === 'l' ? {} : { m: 2, width: 'calc(100% - 32px)', maxHeight: 'calc(100% - 32px)' },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: '24px 24px 8px' }}>
        {tone && (
          <Box
            aria-hidden
            sx={{
              width: 32,
              height: 32,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              bgcolor: ICON_TINT[tone],
              color: tone === 'warning' ? WARNING : 'error.main',
            }}
          >
            {variant === 'destructive' ? <DeleteIcon sx={{ fontSize: 18 }} /> : <WarningIcon sx={{ fontSize: 18 }} />}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* variant="inherit" keeps the theme's heading variants (600 !important) out of the way. */}
          <DialogTitle
            variant="inherit"
            sx={{
              p: 0,
              fontSize: 24,
              lineHeight: '32px',
              fontWeight: 500,
              color: 'primary.dark',
              overflowWrap: 'anywhere',
            }}
            data-testid={dataTestIds.dialog.title}
          >
            {title}
          </DialogTitle>
          {subtitle && (
            <Typography sx={{ mt: '2px', fontSize: 14, lineHeight: '20px', fontWeight: 400, color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label="Close"
          onClick={handleClose}
          disabled={busy}
          sx={{ width: 32, height: 32, mr: -1, flex: 'none', color: 'text.secondary' }}
          data-testid={dataTestIds.dialog.closeButton}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <DialogContent
        sx={{
          p: disableContentPadding ? 0 : '8px 24px 20px',
          fontSize: 14,
          lineHeight: '20px',
          color: 'text.primary',
        }}
      >
        {children}
      </DialogContent>

      {hasFooter && (
        <DialogActions disableSpacing sx={{ p: '8px 24px 20px', gap: 1, flexWrap: 'wrap' }}>
          {!informationOnly && (
            <LoadingButton
              variant="outlined"
              onClick={dismiss?.onClick ?? handleClose}
              disabled={busy}
              sx={buttonSx}
              data-testid={dismiss?.['data-testid'] ?? dataTestIds.dialog.cancelButton}
            >
              {dismissLabel}
            </LoadingButton>
          )}
          <Box sx={{ flex: 1 }} />
          {footerNote && (
            <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
              {footerNote}
            </Typography>
          )}
          {actions.map((action) => (
            <LoadingButton
              key={action.label}
              variant="outlined"
              color={action.tone === 'error' ? 'error' : 'primary'}
              onClick={action.onClick}
              loading={action.loading}
              disabled={action.disabled || (busy && !action.loading)}
              startIcon={action.startIcon}
              sx={buttonSx}
              data-testid={action['data-testid']}
            >
              {action.label}
            </LoadingButton>
          ))}
          {informationOnly ? (
            <LoadingButton
              variant="contained"
              onClick={dismiss?.onClick ?? handleClose}
              sx={buttonSx}
              data-testid={dismiss?.['data-testid'] ?? dataTestIds.dialog.cancelButton}
            >
              {dismiss?.label ?? 'Close'}
            </LoadingButton>
          ) : (
            primary && (
              <LoadingButton
                variant="contained"
                color={variant === 'destructive' ? 'error' : 'primary'}
                type={onSubmit && !primary.onClick ? 'submit' : 'button'}
                onClick={primary.onClick}
                loading={primary.loading}
                disabled={primary.disabled || (busy && !primary.loading)}
                sx={primaryIsWarning ? [buttonSx, warningButtonSx].flat() : buttonSx}
                data-testid={primary['data-testid'] ?? dataTestIds.dialog.proceedButton}
              >
                {primary.label}
              </LoadingButton>
            )
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}
