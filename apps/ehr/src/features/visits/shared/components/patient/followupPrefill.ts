import { VisitType } from 'config-types/config/booking';
import { Appointment } from 'fhir/r4b';
import {
  appointmentAttendanceTypeAppointment,
  appointmentTypeForAppointment,
  getServiceCategoryCodeFromAppointment,
} from 'utils/lib/fhir/appointments';
import { AppointmentAttendanceType, AppointmentType } from 'utils/lib/types/api/appointment.types';

/**
 * Values carried from the initial (parent) visit into the Add Visit form when staff
 * start a scheduled follow-up. Everything here is a starting point only — each field
 * maps to an enabled control the provider can change before submitting.
 */
export interface FollowupPrefill {
  visitType?: VisitType;
  serviceCategoryCode?: string;
}

// The Add Visit form's visit type collapses two independent appointment facets — how
// the patient attends (module tag) and how the visit was booked (appointmentType) —
// into one dropdown value. `virtual` has no post-telemed entry because a post-telemed
// visit is an in-person follow-up to a virtual one by definition; that combination
// yields no prefill and the provider picks the visit type themselves.
const VISIT_TYPE_BY_ATTENDANCE: Record<AppointmentAttendanceType, Partial<Record<AppointmentType, VisitType>>> = {
  'in-person': {
    'walk-in': VisitType.InPersonWalkIn,
    'pre-booked': VisitType.InPersonPreBook,
    'post-telemed': VisitType.InPersonPostTelemed,
  },
  virtual: {
    'walk-in': VisitType.VirtualOnDemand,
    'pre-booked': VisitType.VirtualScheduled,
  },
};

/**
 * Derives the Add Visit form prefill from the follow-up's parent appointment. Fields the
 * parent doesn't pin down are left undefined so the form falls back to its own defaults.
 */
export const getFollowupPrefill = (appointment: Appointment | undefined): FollowupPrefill => {
  if (!appointment) return {};

  const attendance = appointmentAttendanceTypeAppointment(appointment);

  return {
    visitType: attendance
      ? VISIT_TYPE_BY_ATTENDANCE[attendance][appointmentTypeForAppointment(appointment)]
      : undefined,
    serviceCategoryCode: getServiceCategoryCodeFromAppointment(appointment),
  };
};
