import { Link } from 'react-router-dom';

export const appointmentNotFoundInformation = (
  <>
    This appointment is not found. You may have received an invalid appointment, or the appointment may have happened
    already.
    <br />
    <br />
    <Link to="/">Go to the homepage</Link>&nbsp;to book an appointment.
  </>
);
