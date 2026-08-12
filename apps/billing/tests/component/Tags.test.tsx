import { render, screen } from '@testing-library/react';
import { BillingTag } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Tags from '../../src/pages/Tags';

const { searchBillingTagsMock, saveBillingTagMock, deleteBillingTagMock } = vi.hoisted(() => ({
  searchBillingTagsMock: vi.fn(),
  saveBillingTagMock: vi.fn(),
  deleteBillingTagMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  searchBillingTags: searchBillingTagsMock,
  saveBillingTag: saveBillingTagMock,
  deleteBillingTag: deleteBillingTagMock,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));

const userTag: BillingTag = {
  id: 'tag-1',
  name: 'VIP',
  description: 'White-glove payers',
  usage: 4,
  updatedAt: '2026-07-01T00:00:00Z',
  isSystemTag: false,
};

// A system-managed tag that has never been stored: no id, no updatedAt (search-billing-tags always
// reports these so they show up before first use).
const systemTag: BillingTag = {
  id: '',
  name: 'Hold',
  description: 'Holds the claim.',
  usage: 0,
  updatedAt: '',
  isSystemTag: true,
};

describe('Tags page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchBillingTagsMock.mockResolvedValue({ tags: [userTag, systemTag] });
  });

  it('lists system-managed tags (even unstored ones) with a System badge', async () => {
    render(<Tags />);

    expect(await screen.findByText('Hold')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getAllByText('System')).toHaveLength(1);
  });

  it('offers edit/delete for user tags but not for system-managed tags', async () => {
    render(<Tags />);

    await screen.findByText('Hold');
    expect(screen.getByRole('button', { name: 'Edit tag VIP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete tag VIP' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit tag Hold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete tag Hold' })).not.toBeInTheDocument();
  });
});
