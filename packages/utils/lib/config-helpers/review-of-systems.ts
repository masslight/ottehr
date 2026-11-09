import { collectKnownRosFields } from '../ottehr-config/review-of-systems';
import { InPersonRosConfig } from '../ottehr-config/review-of-systems/in-person.config';
import { ExamObservationDTO } from '../types/api/chart-data/chart-data.types';

/** Whether a ROS observation holds a checked finding or a comment. */
export const isRosObservationSet = (observation: ExamObservationDTO | undefined): boolean =>
  observation?.value === true || !!observation?.note?.trim();

export const getRosCommentFieldKey = (systemKey: string): string => `ros-${systemKey}-comment`;

export const ROS_COMMENT_FIELD_KEYS: string[] = Object.keys(InPersonRosConfig).map(getRosCommentFieldKey);

export const getRosSystemKeyForCommentField = (field: string): string | undefined =>
  Object.keys(InPersonRosConfig).find((systemKey) => getRosCommentFieldKey(systemKey) === field);

/** Every known ROS field key: the -denies/-reports findings plus each system's comment. */
export const collectKnownRosFieldsWithComments = (): Set<string> =>
  new Set([...collectKnownRosFields(), ...ROS_COMMENT_FIELD_KEYS]);
