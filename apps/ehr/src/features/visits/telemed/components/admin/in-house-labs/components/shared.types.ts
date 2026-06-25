import { Theme } from '@mui/material';
import { FieldArrayWithId } from 'react-hook-form';
import { AdminInHouseLabItemDefinition } from 'utils';

export type FieldArrayListItemProps<TFieldName extends 'cptCode' | 'components'> = {
  fieldData: FieldArrayWithId<AdminInHouseLabItemDefinition, TFieldName, 'id'>;
  index: number;
  remove: (index?: number | number[]) => void;
  theme: Theme;
};
