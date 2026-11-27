import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import { BillingCard } from 'utils/lib/types/data/billing/billing.types';
import { cardBrandName } from '../utils/format';

export const cardLabel = (card: BillingCard): string => {
  const expiry = `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
  return `${cardBrandName(card.brand)} •••• ${card.lastFour} (exp ${expiry})${card.default ? ' (Primary)' : ''}`;
};

export function CardSelect<T extends FieldValues>({
  control,
  name,
  cards,
  loading,
  error,
  emptyMessage,
  disabled = false,
}: {
  control: Control<T>;
  name: Path<T>;
  cards: BillingCard[];
  loading: boolean;
  error: string;
  emptyMessage: string;
  disabled?: boolean;
}): ReactElement {
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading saved cards…
        </Typography>
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (cards.length === 0) return <Alert severity="info">{emptyMessage}</Alert>;
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: 'Select a card',
      }}
      render={({ field, fieldState: { error: fieldError } }) => (
        <FormControl size="small" fullWidth error={!!fieldError} disabled={disabled}>
          <InputLabel id="payment-card-label">Card *</InputLabel>
          <Select
            labelId="payment-card-label"
            label="Card *"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          >
            {cards.map((card) => (
              <MenuItem key={card.id} value={card.id}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <CreditCardBrandIcon brand={card.brand} />
                  {cardLabel(card)}
                </Box>
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{fieldError?.message ?? 'The card is charged today.'}</FormHelperText>
        </FormControl>
      )}
    />
  );
}
