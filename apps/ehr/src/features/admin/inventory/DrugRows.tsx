import { otherColors } from '@ehrTheme/colors';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { Button, IconButton, Link, TableCell, TableRow } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment, ReactElement, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InventoryDrugRow, InventoryLotRow, InventoryMarker } from 'utils/lib/types/api/config/in-house-medications';
import AdjustStockDialog from './AdjustStockDialog';
import CountLotDialog from './CountLotDialog';
import { formatExpiration, formatQuantity, MarkerChips, useToggleSet } from './inventory.helpers';
import { INVENTORY_QUERY_KEY } from './inventory.queries';
import { LotHistory } from './LotHistory';

const reorderLabel = (reorderLevel: number | undefined): string =>
  reorderLevel === undefined ? 'no reorder level' : `reorder at ${reorderLevel}`;

interface ExpandButtonProps {
  open: boolean;
  onClick: () => void;
  indent?: boolean;
}

const ExpandButton = ({ open, onClick, indent }: ExpandButtonProps): ReactElement => {
  return (
    <IconButton size="small" onClick={onClick} aria-label={open ? 'Collapse' : 'Expand'} sx={{ ml: indent ? 2 : 0 }}>
      {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
    </IconButton>
  );
};

interface DrugHeaderCellsProps {
  drug: InventoryDrugRow;
  open: boolean;
  onToggle: () => void;
  onHandMarkers: InventoryMarker[];
}

const DrugHeaderCells = ({ drug, open, onToggle, onHandMarkers }: DrugHeaderCellsProps): ReactElement => {
  return (
    <>
      <TableCell>
        <ExpandButton open={open} onClick={onToggle} />
      </TableCell>
      <TableCell sx={{ fontWeight: 500 }}>
        <Link component={RouterLink} to={`/admin/medication/${drug.medicationId}`} underline="hover">
          {drug.name}
        </Link>
      </TableCell>
      <TableCell>
        {formatQuantity(drug.onHand, drug.countedAs)}
        <MarkerChips markers={drug.markers} only={onHandMarkers} />
      </TableCell>
    </>
  );
};

interface AllLocationsDrugRowsProps {
  drug: InventoryDrugRow;
  open: boolean;
  onToggle: () => void;
}

export const AllLocationsDrugRows = ({ drug, open, onToggle }: AllLocationsDrugRowsProps): ReactElement => {
  return (
    <>
      <TableRow
        sx={{ backgroundColor: open ? otherColors.apptHover : undefined }}
        data-testid={dataTestIds.inventoryPage.medicationRow(drug.medicationId)}
      >
        <DrugHeaderCells drug={drug} open={open} onToggle={onToggle} onHandMarkers={['below-zero']} />
        <TableCell>
          {drug.locationsBelowReorderLevel} of {drug.locationsWithReorderLevel}
          <MarkerChips markers={drug.markers} only={['low']} />
        </TableCell>
        <TableCell>
          {formatExpiration(drug.earliestExpiration)}
          <MarkerChips markers={drug.markers} only={['expiring', 'expired']} />
        </TableCell>
      </TableRow>
      {open &&
        drug.locations.map((line) => (
          <TableRow key={line.locationId}>
            <TableCell />
            <TableCell sx={{ pl: 3.5, color: 'text.secondary' }}>{line.locationName}</TableCell>
            <TableCell>
              {formatQuantity(line.onHand, drug.countedAs)}
              <MarkerChips markers={line.markers} only={['low', 'below-zero']} />
            </TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>{reorderLabel(line.reorderLevel)}</TableCell>
            <TableCell>{formatExpiration(line.earliestExpiration)}</TableCell>
          </TableRow>
        ))}
    </>
  );
};

interface LocationDrugRowsProps {
  drug: InventoryDrugRow;
  locationName: string;
  open: boolean;
  onToggle: () => void;
}

export const LocationDrugRows = ({ drug, locationName, open, onToggle }: LocationDrugRowsProps): ReactElement => {
  const queryClient = useQueryClient();
  const [expandedLots, toggleLot] = useToggleSet();
  const [dialog, setDialog] = useState<{ kind: 'adjust' | 'count'; lot: InventoryLotRow } | undefined>(undefined);
  const refresh = (): void => void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY] });
  const [showEmptyLots, setShowEmptyLots] = useState(false);
  const emptyLotCount = drug.lots.filter((lot) => lot.onHand === 0).length;
  const visibleLots = showEmptyLots ? drug.lots : drug.lots.filter((lot) => lot.onHand !== 0);

  return (
    <>
      <TableRow
        sx={{ backgroundColor: open ? otherColors.apptHover : undefined }}
        data-testid={dataTestIds.inventoryPage.medicationRow(drug.medicationId)}
      >
        <DrugHeaderCells drug={drug} open={open} onToggle={onToggle} onHandMarkers={['low', 'below-zero']} />
        <TableCell>{reorderLabel(drug.reorderLevel)}</TableCell>
        <TableCell />
        <TableCell />
      </TableRow>
      {open &&
        visibleLots.map((lot) => (
          <Fragment key={lot.id}>
            <TableRow data-testid={dataTestIds.inventoryPage.lotRow(lot.id)}>
              <TableCell>
                <ExpandButton open={expandedLots.has(lot.id)} onClick={() => toggleLot(lot.id)} indent />
              </TableCell>
              <TableCell>Lot {lot.lotNumber}</TableCell>
              <TableCell>
                {formatQuantity(lot.onHand, lot.unit)}
                <MarkerChips markers={lot.markers} only={['below-zero']} />
              </TableCell>
              <TableCell>
                {formatExpiration(lot.expirationDate)}
                <MarkerChips markers={lot.markers} only={['expiring', 'expired']} />
              </TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {[lot.ndc, lot.manufacturer].filter(Boolean).join(' · ')}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Button
                  size="small"
                  onClick={() => setDialog({ kind: 'count', lot })}
                  sx={{ textTransform: 'none' }}
                  data-testid={dataTestIds.inventoryPage.countButton(lot.id)}
                >
                  Count
                </Button>
                <Button
                  size="small"
                  onClick={() => setDialog({ kind: 'adjust', lot })}
                  sx={{ textTransform: 'none' }}
                  data-testid={dataTestIds.inventoryPage.adjustButton(lot.id)}
                >
                  Adjust
                </Button>
              </TableCell>
            </TableRow>
            {expandedLots.has(lot.id) && (
              <TableRow>
                <TableCell />
                <TableCell colSpan={5} sx={{ pl: 5, pb: 2 }}>
                  <LotHistory lot={lot} />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      {open && emptyLotCount > 0 && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={5}>
            <Link component="button" type="button" variant="body2" onClick={() => setShowEmptyLots((prev) => !prev)}>
              {showEmptyLots
                ? 'Hide empty lots'
                : `Show ${emptyLotCount} empty ${emptyLotCount === 1 ? 'lot' : 'lots'}`}
            </Link>
          </TableCell>
        </TableRow>
      )}
      {dialog?.kind === 'adjust' && (
        <AdjustStockDialog
          open
          onClose={() => setDialog(undefined)}
          onSaved={refresh}
          drug={drug}
          lot={dialog.lot}
          locationName={locationName}
        />
      )}
      {dialog?.kind === 'count' && (
        <CountLotDialog
          open
          onClose={() => setDialog(undefined)}
          onSaved={refresh}
          drug={drug}
          lot={dialog.lot}
          locationName={locationName}
        />
      )}
    </>
  );
};
