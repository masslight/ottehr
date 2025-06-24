import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { VisitType } from 'utils';

interface TrackMixpanelEventsProps {
  eventName: string;
  visitType: VisitType | undefined;
  loading?: boolean;
  bookingCity?: string | undefined;
  bookingState?: string | undefined;
  mobileOptIn?: boolean;
}

// Track page view and time spent on page in Mixpanel
export function useTrackMixpanelEvents({
  eventName,
  visitType,
  loading = false,
  bookingCity,
  bookingState,
  mobileOptIn,
}: TrackMixpanelEventsProps): void {
  const location = useLocation();
  const { id: appointmentID } = useParams();

  useEffect(() => {
    if (eventName && !loading) {
      // Track pageview
      const pagepath = appointmentID ? location.pathname.replace(`/${appointmentID}`, '') : location.pathname;
      // cSpell:ignore mrkt, pagepath, pagetitle, bookingcity, bookingstate
      mixpanel.track('mrkt_pageview_evt', {
        pagepath: pagepath,
        pagetitle: eventName,
        patientFlow: visitType,
        uc_bookingcity_evt: bookingCity,
        uc_bookingstate_evt: bookingState,
        mobileOptIn: mobileOptIn,
      });
    }
  }, [loading, location.pathname, visitType, bookingCity, bookingState, mobileOptIn, appointmentID, eventName]);
}
