import { Box, Button, Checkbox, Collapse, Paper, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { sidebarMenuIcons } from '../sidebarMenuIcons';
import { ProvenanceContent, ProvenancePanel, ProvenanceToggle } from './Provenance';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { getVisitBasePath, IN_HOUSE_MEDICATION_ORDER_ROUTE } from './scribeSections';
import { AI_SURFACE } from './ScribeStage';
import { OrderSuggestion } from './types';

const testIds = dataTestIds.scribeRecommendations;

/**
 * Stage three. An order is a clinical decision with its own workflow, so nothing here is ever
 * written by the panel: it is a checklist the provider works through and ticks off by hand.
 */
export const OrderSuggestions: FC = () => {
  const orderSuggestions = useScribeRecommendationsStore((state) => state.orderSuggestions);
  const ordersDone = useScribeRecommendationsStore((state) => state.ordersDone);
  const setOrderDone = useScribeRecommendationsStore((state) => state.setOrderDone);
  const startOrder = useStartOrder();

  if (orderSuggestions.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Paper variant="outlined">
        {orderSuggestions.map((order) => (
          <OrderSuggestionRow
            key={order.id}
            order={order}
            done={Boolean(ordersDone[order.id])}
            onDoneChange={(done) => setOrderDone(order.id, done)}
            onStartOrder={startOrder}
          />
        ))}
      </Paper>
      <Typography variant="caption" color="text.secondary">
        Nothing here is ordered automatically.
      </Typography>
    </Box>
  );
};

/** Takes the provider to the in-house medication order screen of the visit they are on. */
export const useStartOrder = (): (() => void) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return () => {
    const base = getVisitBasePath(pathname);
    if (base) navigate(`${base}/${IN_HOUSE_MEDICATION_ORDER_ROUTE}`);
  };
};

interface OrderSuggestionRowProps {
  order: OrderSuggestion;
  done: boolean;
  onDoneChange: (done: boolean) => void;
  onStartOrder: () => void;
  /** The host already shows the rationale (the narrative does, on hover), so the row needn't. */
  hideProvenance?: boolean;
}

export const OrderSuggestionRow: FC<OrderSuggestionRowProps> = ({
  order,
  done,
  onDoneChange,
  onStartOrder,
  hideProvenance,
}) => {
  const theme = useTheme();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const isHighlighted = useScribeRecommendationsStore((state) => state.hoveredItemId === order.id);
  const setHoveredItemId = useScribeRecommendationsStore((state) => state.setHoveredItemId);
  const provenance = { note: order.rationale, evidence: order.evidence };

  return (
    <Box
      data-testid={testIds.orderSuggestion(order.id)}
      onMouseEnter={() => setHoveredItemId(order.id)}
      onMouseLeave={() => setHoveredItemId(undefined)}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        px: 1,
        py: 0.75,
        backgroundColor: isHighlighted ? AI_SURFACE : undefined,
        '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' },
      }}
    >
      <Checkbox
        size="small"
        checked={done}
        onChange={(event) => onDoneChange(event.target.checked)}
        inputProps={{ 'aria-label': `Mark ${order.name} as done` }}
        data-testid={testIds.orderCheckbox(order.id)}
        sx={{ p: 0.5, mt: -0.25 }}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
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
        <Collapse in={isDetailOpen} unmountOnExit>
          <ProvenancePanel dataTestId={testIds.orderDetail(order.id)}>
            <ProvenanceContent {...provenance} />
          </ProvenancePanel>
        </Collapse>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
        {!hideProvenance && (
          <ProvenanceToggle
            content={<ProvenanceContent {...provenance} />}
            isOpen={isDetailOpen}
            onToggle={() => setIsDetailOpen((open) => !open)}
            subject={order.name}
            dataTestId={testIds.orderDetailButton(order.id)}
          />
        )}
        <Button
          size="small"
          variant="outlined"
          onClick={onStartOrder}
          disabled={done}
          data-testid={testIds.orderButton(order.id)}
          sx={{ textTransform: 'none', borderRadius: 100, whiteSpace: 'nowrap' }}
        >
          Order
        </Button>
      </Box>
    </Box>
  );
};
