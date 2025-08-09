import { ExamTabCardNames, InPersonExamTabProviderCardNames } from 'utils';
import { useFeatureFlags } from '../../features/css-module/context/featureFlags';
import { useExamCardsStore, useInPersonExamCardsStore } from '../state/appointment/exam-cards.store';

export const useExamCardCollapsed = (
  cardName: ExamTabCardNames | InPersonExamTabProviderCardNames
): [boolean, () => void] => {
  const { css } = useFeatureFlags();

  /* eslint-disable react-hooks/rules-of-hooks */
  const isCollapsed = css
    ? useInPersonExamCardsStore((state) => state[cardName as InPersonExamTabProviderCardNames])
    : useExamCardsStore((state) => state[cardName as ExamTabCardNames]);

  const onSwitch = (): void => {
    if (css) {
      useInPersonExamCardsStore.setState((prevState) => ({
        [cardName]: !prevState[cardName as InPersonExamTabProviderCardNames],
      }));
    } else {
      useExamCardsStore.setState((prevState) => ({ [cardName]: !prevState[cardName as ExamTabCardNames] }));
    }
  };

  return [isCollapsed, onSwitch];
};
