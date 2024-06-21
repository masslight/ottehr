import { FC } from 'react';
import { ExamFieldsNames } from 'ehr-utils';
import { ExamObservationFieldsDetails, examObservationFieldsDetailsArray } from '../../../../utils';
import { ControlledExamCheckbox } from './ControlledExamCheckbox';
import { ControlledExamRadioGroup } from './ControlledExamRadioGroup';
import { ExamTabProviderCardNames, ExamTabGroupNames } from '../../../../../types/types';

type ExamFieldsFactoryProps = { radio?: boolean } & (
  | {
      fields: ExamFieldsNames[];
      card?: never;
      group?: never;
    }
  | {
      fields?: never;
      card: ExamTabProviderCardNames;
      group: ExamTabGroupNames;
    }
);

export const ExamFieldsFactory: FC<ExamFieldsFactoryProps> = (props) => {
  const { fields, card, group, radio } = props;

  let values: (typeof ExamObservationFieldsDetails)[keyof typeof ExamObservationFieldsDetails][];

  if (card && group) {
    values = examObservationFieldsDetailsArray.filter((details) => details.group === group && details.card === card);
  } else {
    values = fields.map((field) => ExamObservationFieldsDetails[field]);
  }

  const array = values.map((details) =>
    radio ? (
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
    ),
  );

  return <>{array}</>;
};
