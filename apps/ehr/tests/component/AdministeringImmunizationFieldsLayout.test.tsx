import { Grid } from '@mui/material';
import { render } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({ isFetching: false, data: undefined }),
}));

import { AdministeringImmunizationFields } from 'src/features/immunization/components/AdministeringImmunizationFields';

const FormWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const methods = useForm({ defaultValues: { administrationDetails: { cptCodes: [] } } });
  return (
    <FormProvider {...methods}>
      <Grid container spacing={2}>
        {children}
      </Grid>
    </FormProvider>
  );
};

const columnWidth = (item: Element): number => {
  const match = Array.from(item.classList)
    .map((cls) => /^MuiGrid-grid-xs-(\d+)$/.exec(cls))
    .find(Boolean);
  return Number(match?.[1]);
};

describe('AdministeringImmunizationFields layout', () => {
  it('keeps every field on the 4-column grid set by the first row', () => {
    const { container } = render(<AdministeringImmunizationFields />, { wrapper: FormWrapper });
    const widths = Array.from(container.querySelectorAll('.MuiGrid-container > .MuiGrid-item')).map(columnWidth);

    // LOT, NDC, Exp. Date, MVX | CVX, CPT, Administered date, Administered time | VIS checkbox, VIS given date
    expect(widths).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 6, 6]);
  });
});
