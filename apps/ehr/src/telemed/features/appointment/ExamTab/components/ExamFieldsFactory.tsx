import { Box } from '@mui/material';
import { FC } from 'react';
import {
  ExamFieldsNames,
  ExamObservationFieldsDetails,
  examObservationFieldsDetailsArray,
  ExamTabGroupNames,
  ExamTabProviderCardNames,
  inPersonExamObservationFieldsDetailsArray,
  InPersonExamTabProviderCardNames,
} from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { ControlledExamCheckbox } from './ControlledExamCheckbox';
import { ControlledExamRadioGroup } from './ControlledExamRadioGroup';

type ExamFieldsFactoryProps = { radio?: boolean } & (
  | {
      fields: ExamFieldsNames[];
      card?: never;
      group?: never;
    }
  | {
      fields?: never;
      card: ExamTabProviderCardNames | InPersonExamTabProviderCardNames;
      group: ExamTabGroupNames;
    }
);

export const ExamFieldsFactory: FC<ExamFieldsFactoryProps> = (props) => {
  const { fields, card, group, radio } = props;

  const { css } = useFeatureFlags();
  let values: (typeof ExamObservationFieldsDetails)[keyof typeof ExamObservationFieldsDetails][];

  if (card && group) {
    if (css) {
      values = inPersonExamObservationFieldsDetailsArray.filter(
        (details) => details.group === group && details.card === card
      ) as typeof values;
    } else {
      values = examObservationFieldsDetailsArray.filter((details) => details.group === group && details.card === card);
    }
  } else {
    values = fields.map((field) => ExamObservationFieldsDetails[field]);
  }

  const array = values.map((details) => (
    <Box data-testid={dataTestIds.telemedEhrFlow.examTabField(details.field)}>
      {radio ? (
        <ControlledExamRadioGroup
          key={details.field}
          name={details.field}
          label={details.label}
          abnormal={details.abnormal}
        />
      ) : (
        <ControlledExamCheckbox
          key={details.field}
          name={details.field}
          label={details.label}
          abnormal={details.abnormal}
        />
      )}
    </Box>
  ));

  return <>{array}</>;
};
