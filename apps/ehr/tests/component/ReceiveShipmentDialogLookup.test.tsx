import { render, screen } from '@testing-library/react';
import { Medication } from 'fhir/r4b';
import { NdcLookupState } from 'src/features/admin/inventory/useNdcLookup';
import { VACCINE_DEFAULT_INVENTORY } from 'utils/lib/types/api/config/in-house-medications';
import { describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => ({ state: { status: 'idle' } as NdcLookupState }));

vi.mock('src/features/admin/inventory/useNdcLookup', () => ({ useNdcLookup: () => lookup.state }));
vi.mock('src/features/admin/inventory/inventory.queries', () => ({ useLastReceivedLot: () => ({ data: undefined }) }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: undefined }) }));

import ReceiveShipmentDialog from '../../src/features/admin/inventory/ReceiveShipmentDialog';

const medication = { resourceType: 'Medication', id: 'med-1', code: { text: 'Engerix-B' } } as Medication & {
  id: string;
};
const product = { packageNdc: '58160-0806-52', name: 'Pediarix', manufacturer: 'GlaxoSmithKline', rxcuis: [] };
const vaccine = { cvx: '110', vaccineName: 'Pediarix', mvx: 'SKB' };

const renderDialog = (): void => {
  render(
    <ReceiveShipmentDialog
      open
      onClose={vi.fn()}
      medication={medication}
      inventory={VACCINE_DEFAULT_INVENTORY}
      locations={[{ id: 'loc-1', name: 'Main' }]}
    />
  );
};

describe('ReceiveShipmentDialog — NDC lookup shows no codes', () => {
  it('names the product and manufacturer, without the MVX code', () => {
    lookup.state = { status: 'match', comparedBy: 'cvx', product, vaccine };
    renderDialog();
    expect(screen.getByText('Pediarix · GlaxoSmithKline')).toBeInTheDocument();
    expect(screen.queryByText(/MVX|SKB/)).not.toBeInTheDocument();
  });

  it('says which vaccine the box is on a mismatch, without the CVX code', () => {
    lookup.state = { status: 'mismatch', comparedBy: 'cvx', product, vaccine };
    renderDialog();
    expect(
      screen.getByText(/^NDC 58160-0806-52 is Pediarix, not .*\. Check the box before saving\.$/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/CVX/)).not.toBeInTheDocument();
  });
});
