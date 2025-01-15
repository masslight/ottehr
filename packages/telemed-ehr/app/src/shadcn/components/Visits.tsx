import { formatISOStringToDateAndTime } from '@/helpers/formatDateTime';
import { formatMinutes } from '@/helpers/visitDurationUtils';
import { Appointment } from 'fhir/r4';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CalendarDays, Clock, MapPin, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getVisitTypeLabelForAppointment } from '@/types/types';

export const AppointmentHistory = ({ appointments }: { appointments: Appointment[] }) => {
  if (!appointments?.length) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="pt-6 text-center text-gray-500">No visit history available</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {appointments.map((appointment) => {
        const locationRef = appointment.participant
          ?.find((p) => p.actor?.reference?.startsWith('Location/'))
          ?.actor?.reference?.replace('Location/', '');

        return (
          <Link key={appointment.id} to={`/visit/${appointment.id}`} className="block transition-all hover:shadow-md">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant={appointment.status === 'finished' ? 'default' : 'secondary'} className="mb-2">
                    {appointment.status?.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-500">ID: {appointment.id}</span>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <CalendarDays className="h-4 w-4" />
                  <span>{appointment.start ? formatISOStringToDateAndTime(appointment.start) : 'No date'}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{appointment.length} mins</span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <Activity className="h-4 w-4" />
                  <span>{appointment.office}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{locationRef || 'Location N/A'}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};

export default AppointmentHistory;

{
  /* <Card className="flex flex-col py-4">
            <CardContent>
              <div>{appointment.dateTime ? formatISOStringToDateAndTime(appointment.dateTime) : '-'}</div>
              <div>{appointment.office}</div>
              <div>{appointment.length} mins</div>
              <div>{appointment.type}</div>
            </CardContent>
          </Card> */
}
