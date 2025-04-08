import { Closure } from '../../../main';
import { DailySchedule, ScheduleOverrides } from '../../../utils';

export interface UpdateScheduleParams {
  scheduleId: string;
  timezone?: string;
  schedule?: DailySchedule;
  scheduleOverrides?: ScheduleOverrides;
  closures?: Closure[];
}
