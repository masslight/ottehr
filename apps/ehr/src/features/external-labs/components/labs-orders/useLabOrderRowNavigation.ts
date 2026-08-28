import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FollowUpAppointmentLookup,
  getDrExternalLabEditUrl,
  getExternalLabOrderEditUrl,
  resolveOrderRoutingFromFollowUpLookup,
} from 'src/features/visits/in-person/routing/helpers';
import { LabOrderListPageDTO, ReflexLabDTO } from 'utils/lib/types/data/labs/labs.types';

/**
 * Opens a lab order on its own screen. The lab tables take their row handlers as props, so
 * this is what the screens that route to those pages pass in.
 */
export const useLabOrderRowNavigation = (
  followUpAppointmentLookup?: FollowUpAppointmentLookup
): {
  openOrder: (labOrderData: LabOrderListPageDTO) => void;
  openDrDrivenResult: (result: ReflexLabDTO) => void;
} => {
  const navigateTo = useNavigate();
  const { id: appointmentIdFromUrl } = useParams();
  const [searchParams] = useSearchParams();
  const encounterIdParam = searchParams.get('encounterId');

  const buildOrderUrl = (orderAppointmentId: string, urlBuilder: (appointmentId: string) => string): string => {
    if (followUpAppointmentLookup) {
      const { appointmentId, encounterIdQuery } = resolveOrderRoutingFromFollowUpLookup(
        orderAppointmentId,
        followUpAppointmentLookup
      );
      const baseUrl = urlBuilder(appointmentId);
      return encounterIdQuery ? `${baseUrl}?encounterId=${encounterIdQuery}` : baseUrl;
    }
    const appointmentId = appointmentIdFromUrl || orderAppointmentId;
    const baseUrl = urlBuilder(appointmentId);
    return encounterIdParam ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}encounterId=${encounterIdParam}` : baseUrl;
  };

  return {
    openOrder: (labOrderData) =>
      navigateTo(
        buildOrderUrl(labOrderData.appointmentId, (apptId) =>
          getExternalLabOrderEditUrl(apptId, labOrderData.serviceRequestId)
        )
      ),
    openDrDrivenResult: (result) => {
      if (!result.appointmentId || !result.resultsDetails?.[0].diagnosticReportId) {
        console.error(`Unable to navigate to dr result row, missing appointmentId or dr id`, result);
        throw new Error('Unable to navigate to dr result row, missing appointmentId or dr id');
      }
      // todo labs future resultsDetails maybe does not need to be an array anymore
      navigateTo(
        buildOrderUrl(result.appointmentId, (apptId) =>
          getDrExternalLabEditUrl(apptId, result.resultsDetails?.[0].diagnosticReportId ?? '')
        )
      );
    },
  };
};
