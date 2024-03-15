export interface ControlButtonsProps {
  submitLabel?: string;
  submitDisabled?: boolean;
  backButton?: boolean;
  backButtonLabel?: string;
  loading?: boolean;
  onBack?: () => void;
}
