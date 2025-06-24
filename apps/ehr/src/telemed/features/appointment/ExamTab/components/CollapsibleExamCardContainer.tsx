import { FC } from 'react';
import { ExamTabCardNames, InPersonExamTabProviderCardNames } from 'utils';
import { useExamCardCollapsed } from '../../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCardContainerProps } from './ExamCardContainer';

type CollapsibleExamCardContainerProps = Omit<ExamCardContainerProps, 'collapsed' | 'onSwitch'> & {
  cardName: ExamTabCardNames | InPersonExamTabProviderCardNames;
};

export const CollapsibleExamCardContainer: FC<CollapsibleExamCardContainerProps> = (props) => {
  const { cardName, ...innerProps } = props;
  const [isCollapsed, onSwitch] = useExamCardCollapsed(cardName);

  return <ExamCardContainer collapsed={isCollapsed} onSwitch={onSwitch} {...innerProps} />;
};
