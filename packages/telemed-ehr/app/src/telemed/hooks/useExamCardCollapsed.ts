import { ExamTabCardNames } from '../../types/types';
import { useExamCardsStore } from '../state/appointment/exam-cards.store';

export const useExamCardCollapsed = (cardName: ExamTabCardNames): [boolean, () => void] => {
  const isCollapsed = useExamCardsStore((state) => state[cardName]);

  const onSwitch = (): void => {
    useExamCardsStore.setState((prevState) => ({ [cardName]: !prevState[cardName] }));
  };

  return [isCollapsed, onSwitch];
};
