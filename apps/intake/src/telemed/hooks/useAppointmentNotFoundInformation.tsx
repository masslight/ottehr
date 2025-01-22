import { Link } from 'react-router-dom';

const useAppointmentNotFoundInformation = (): JSX.Element => {
  return (
    <>
      {
        'This appointment is not found. You may have received an invalid appointment, or the appointment may have happened already.'
      }
      <br />
      <br />
      <Link to="/">{'Go to the homepage'}</Link>&nbsp;{'to book an appointment.'}
    </>
  );
};

export default useAppointmentNotFoundInformation;
