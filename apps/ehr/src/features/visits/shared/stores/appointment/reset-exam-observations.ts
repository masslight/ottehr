import { useExamObservationsInitializationStore, useExamObservationsStore } from './exam-observations.store';

/**
 * Resets exam observations store to initial state.
 * Use this when you need to force reload exam data from the server,
 */
export const resetExamObservationsStore = (): void => {
  useExamObservationsStore.setState({}, true);
  useExamObservationsInitializationStore.setState({ hasInitialData: false });
};
