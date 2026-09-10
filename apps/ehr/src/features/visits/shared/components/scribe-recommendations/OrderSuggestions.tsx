import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { Box, Button, Checkbox, Paper, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { sidebarMenuIcons } from '../sidebarMenuIcons';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { getVisitBasePath, IN_HOUSE_MEDICATION_ORDER_ROUTE } from './scribeSections';

const testIds = dataTestIds.scribeRecommendations;

/**
 * Things the AI proposes ordering. Deliberately not part of "Apply to progress note": an order is
 * a clinical decision with its own workflow, so this is a checklist the provider works through and
 * ticks off by hand.
 */
export const OrderSuggestions: FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const orderSuggestions = useScribeRecommendationsStore((state) => state.orderSuggestions);
  const ordersDone = useScribeRecommendationsStore((state) => state.ordersDone);
  const setOrderDone = useScribeRecommendationsStore((state) => state.setOrderDone);

  if (orderSuggestions.length === 0) return null;

  const startOrder = (): void => {
    const base = getVisitBasePath(pathname);
    if (base) navigate(`${base}/${IN_HOUSE_MEDICATION_ORDER_ROUTE}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', color: theme.palette.primary.dark }}>
          Suggested orders
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You may wish to give one or both of:
        </Typography>
      </Box>
      <Paper variant="outlined">
        {orderSuggestions.map((order) => {
          const done = Boolean(ordersDone[order.id]);
          return (
            <Box
              key={order.id}
              data-testid={testIds.orderSuggestion(order.id)}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0.5,
                px: 1,
                py: 0.75,
                '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' },
              }}
            >
              <Checkbox
                size="small"
                checked={done}
                onChange={(event) => setOrderDone(order.id, event.target.checked)}
                inputProps={{ 'aria-label': `Mark ${order.name} as done` }}
                data-testid={testIds.orderCheckbox(order.id)}
                sx={{ p: 0.5, mt: -0.25 }}
              />
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ display: 'flex', color: theme.palette.primary.dark, '& svg': { width: 16, height: 16 } }}>
                    {sidebarMenuIcons['Med. Administration']}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {order.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    In-house medication
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {order.rationale}
                </Typography>
                {order.evidence && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25, color: 'text.secondary' }}>
                    <FormatQuoteIcon sx={{ fontSize: 14, mt: '1px', flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                      {order.evidence}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={startOrder}
                disabled={done}
                data-testid={testIds.orderButton(order.id)}
                sx={{ textTransform: 'none', borderRadius: 100, flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                Order
              </Button>
            </Box>
          );
        })}
      </Paper>
      <Typography variant="caption" color="text.secondary">
        Orders are never placed automatically. Use “Order” to start one in the note, then tick it off here.
      </Typography>
    </Box>
  );
};
