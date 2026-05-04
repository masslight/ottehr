import { useRosObservationsInitializationStore, useRosObservationsStore } from './ros-observations.store';

/**
 * Resets ROS observations store to initial state.
 * Use this when you need to force reload ROS data from the server.
 */
export const resetRosObservationsStore = (): void => {
  useRosObservationsStore.setState({}, true);
  useRosObservationsInitializationStore.setState({ hasInitialData: false });
};
