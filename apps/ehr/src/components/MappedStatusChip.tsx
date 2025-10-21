import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

export type Mapper<T extends string> = {
  [status in T]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
};

// added to handle different mappers (e.g. IP ones) with same style
export function MappedStatusChip<T extends string>({
  status,
  count,
  mapper,
}: {
  status: T;
  count?: number;
  mapper: Mapper<T>;
}): ReactElement {
  if (!status) {
    return <></>;
  }

  if (!mapper[status]) {
    return <></>;
  }

  // to swap color and background if background is white
  const isBackgroundWhite = /^#(f{3}|f{6})$/i.test(mapper[status].background.primary);

  return (
    <Chip
      size="small"
      label={count ? `${status} - ${count}` : status}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 500,
        textTransform: 'uppercase',
        background: mapper[status][isBackgroundWhite ? 'color' : 'background'].primary,
        color: mapper[status][isBackgroundWhite ? 'background' : 'color'].primary,
      }}
      variant="outlined"
      data-testid={dataTestIds.telemedEhrFlow.appointmentStatusChip}
    />
  );
}
