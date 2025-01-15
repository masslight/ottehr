import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Appointment, Location, Patient, RelatedPerson, Resource } from 'fhir/r4';
import {
  Cake,
  Calendar,
  CalendarPlus2,
  Clock1,
  EllipsisVertical,
  File,
  Home,
  Mail,
  MessageSquare,
  Phone,
  UserRound,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { calculateAge, getInitials } from '@/lib/utils';
import { formatISODateToLocaleDate, formatISOStringToDateAndTime } from '../../helpers/formatDateTime';
import { Skeleton } from '@/components/ui/skeleton';

// const visitInfoFields = [
//   {
//     label: 'Last visit',
//     icon: Calendar,
//     value: '01/01/2025',
//   },
//   {
//     label: 'Paperwork last updated',
//     icon: File,
//     value: '12/26/2024',
//   },
// ];
// const patientInfoFields = [
//   {
//     label: 'Gender',
//     icon: UserRound,
//     value: 'Male',
//   },
//   {
//     label: 'Age',
//     icon: Clock1,
//     value: '32',
//   },
//   {
//     label: 'Birthday',
//     icon: Cake,
//     value: '01/01/2000',
//   },
// ];

// const contactInfoFields = [
//   {
//     label: 'Phone',
//     icon: Phone,
//     value: '(000) 000-0000',
//   },
//   {
//     label: 'Email',
//     icon: Mail,
//     value: 'johnny@walker.com',
//   },
//   {
//     label: 'Address',
//     icon: Home,
//     value: '1234 Main St, Anytown, USA',
//   },
// ];
//
// const sections = [
//   { title: '', fields: visitInfoFields },
//   { title: 'Patient Information', fields: patientInfoFields },
//   { title: 'Contact Information', fields: contactInfoFields },
// ];

export function PatientInfoCard({
  patient,
  loading,
  lastAppointment,
}: {
  patient: Patient | undefined;
  loading: boolean;
  lastAppointment: string | undefined;
}) {
  const location = useLocation();

  useEffect(() => {
    try {
      // Update fields when patient data changes
      const name = patient?.name?.[0];
      const phone = patient?.telecom?.find((t) => t.system === 'phone')?.value;
      const email = patient?.telecom?.find((t) => t.system === 'email')?.value;
      const address = patient?.address?.[0];
      const addressStr = address
        ? `${address.line?.[0] || ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`
        : '-';

      visitInfoFields[0].value = formatISODateToLocaleDate(lastAppointment ?? '') ?? 'No visits'; // Last visit
      visitInfoFields[1].value = formatISODateToLocaleDate(patient?.meta?.lastUpdated ?? ''); // Next visit

      patientInfoFields[0].value = patient?.gender?.charAt(0).toUpperCase() + patient?.gender?.slice(1) || '';
      patientInfoFields[1].value = patient?.birthDate ? calculateAge(patient.birthDate).toString() : '';
      patientInfoFields[2].value = patient?.birthDate || '';

      contactInfoFields[0].value = phone || '';
      contactInfoFields[1].value = email || '';
      contactInfoFields[2].value = addressStr;
    } catch (e) {}
  }, [patient, location.pathname]);

  const patientName = `${patient?.name?.[0]?.family}, ${patient?.name?.[0]?.given?.[0]}`;
  const patientIsActive = patient?.active ?? false;

  // Construct fields data directly from patient
  const visitInfoFields = [
    {
      label: 'Last visit',
      icon: Calendar,
      value: formatISODateToLocaleDate(lastAppointment ?? '') ?? 'No visits',
      // value: formatISODateToLocaleDate(patient?.meta?.lastUpdated ?? 'N/A'), // This would need to come from appointments data
      // value: 'No visits', // This would need to come from appointments data
    },
    {
      label: 'Paperwork last updated',
      icon: File,
      value: formatISODateToLocaleDate(patient?.meta?.lastUpdated ?? ''),
    },
  ];

  const patientInfoFields = [
    {
      label: 'Gender',
      icon: UserRound,
      value: patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '',
    },
    {
      label: 'Age',
      icon: Clock1,
      value: patient?.birthDate ? calculateAge(patient.birthDate).toString() : '',
    },
    {
      label: 'Birthday',
      icon: Cake,
      value: patient?.birthDate || '',
    },
  ];

  const address = patient?.address?.[0];
  const addressStr = address
    ? // check if fields are not empty string
      [
        address.line?.[0] && `${address.line[0]}`,
        address.city && `${address.city}`,
        address.state && `${address.state}`,
        address.postalCode && `${address.postalCode}`,
      ]
        .filter(Boolean)
        .join(', ') || 'N/A'
    : 'N/A';

  const contactInfoFields = [
    {
      label: 'Phone',
      icon: Phone,
      value: patient?.telecom?.find((t) => t.system === 'phone')?.value || 'N/A',
    },
    {
      label: 'Email',
      icon: Mail,
      value: patient?.telecom?.find((t) => t.system === 'email')?.value || 'N/A',
    },
    {
      label: 'Address',
      icon: Home,
      value: addressStr,
    },
  ];

  const sections = [
    { title: '', fields: visitInfoFields },
    { title: 'Patient Information', fields: patientInfoFields },
    { title: 'Contact Information', fields: contactInfoFields },
  ];

  return (
    <Card className="pb-2 xs:w-full lg:w-auto min-w-[400px]">
      <CardHeader>
        {loading ? (
          <Skeleton className="bg-gray-200 w-16 h-16 rounded-full mb-2" />
        ) : (
          <Avatar className="w-16 h-16 mb-2">
            <AvatarImage src={`https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 100)}.jpg`} />
            <AvatarFallback>{getInitials(patientName)}</AvatarFallback>
          </Avatar>
        )}
        {loading ? (
          <Skeleton className="bg-gray-200 flex w-48 h-8" />
        ) : (
          <CardTitle className="flex items-center gap-2">
            {patientName}
            {patientIsActive ? (
              <Badge className="bg-teal-500 text-white hover:bg-teal-500">Active</Badge>
            ) : (
              <Badge className="bg-red-500 text-white hover:bg-red-500">Inactive</Badge>
            )}
          </CardTitle>
        )}
        {loading ? (
          <Skeleton className="bg-gray-200 flex w-24 h-6" />
        ) : (
          <CardDescription className="flex items-center gap-2">{contactInfoFields[0].value}</CardDescription>
        )}
        {loading ? (
          <Skeleton className="bg-gray-200 flex h-8" />
        ) : (
          <div className="pt-2 flex gap-1">
            <Button className="font-bold bg-blue-500 text-white hover:bg-blue-600 px-3">
              <MessageSquare className="w-4 h-4" />
            </Button>
            <Button className="font-bold bg-blue-500 text-white hover:bg-blue-600 px-3">
              <Video className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="font-bold flex-none lg:flex-1 ">
              <CalendarPlus2 className="w-4 h-4" />
              Set Appointment
            </Button>
            <Button variant="outline" className="ml-auto px-3">
              <EllipsisVertical className="h-4" />
            </Button>
          </div>
        )}
      </CardHeader>

      {/* TODO: make info field a recyclable component */}
      {/* TODO: create info object */}
      <CardContent className="space-y-4">
        {sections.map((section) => (
          <div className="flex flex-col gap-2 border-t pt-4">
            {loading && section.title ? (
              <Skeleton className="bg-gray-200 w-48 h-8" />
            ) : section.title ? (
              <h1 className="text-lg font-bold py-1">{section.title}</h1>
            ) : (
              ''
            )}
            {section.fields.map((field) =>
              loading ? (
                <div className="flex justify-between items-center gap-2">
                  <Skeleton
                    className="bg-gray-200 flex h-5"
                    style={{ width: `${Math.floor(Math.random() * (200 - 100 + 1)) + 50}px` }}
                  />
                  <Skeleton
                    className="bg-gray-200 flex h-5"
                    style={{ width: `${Math.floor(Math.random() * (200 - 100 + 1)) + 50}px` }}
                  />
                </div>
              ) : (
                <CardDescription className="flex justify-between items-center cursor-pointers group/item rounded-md">
                  <div className="flex items-center gap-2 ">
                    <field.icon className="w-4 h-4" /> {field.label}
                  </div>
                  <div className="text-gray-700 font-bold text-right group-hover/item:sbg-gray-100 p-1 rounded-md">
                    {field.value}
                  </div>
                </CardDescription>
              ),
            )}
          </div>
        ))}

        <div className="flex flex-col gap-2 border-t pt-4">
          {loading ? (
            <Skeleton className="bg-gray-200 w-48 h-8" />
          ) : (
            <h1 className="text-lg font-bold py-1">Next Visits</h1>
          )}
          {loading ? (
            <div className="flex justify-between items-center gap-2">
              <Skeleton
                className="bg-gray-200 flex h-5"
                style={{ width: `${Math.floor(Math.random() * (200 - 100 + 1)) + 50}px` }}
              />
              <Skeleton
                className="bg-gray-200 flex h-5"
                style={{ width: `${Math.floor(Math.random() * (200 - 100 + 1)) + 50}px` }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <CardDescription className="flex justify-between items-center cursor-pointers group/item rounded-md">
                {/* Visit card component */}
                <Card className="pb-2 p-2 w-full min-w-[400px]">
                  <div className="flex">
                    <div className="h-auto w-2 bg-red-500 mr-4 rounded-full"></div>
                    <div className="flex gap-1 w-full">
                      <div className="flex flex-col flex-1 gap-1">
                        <h3 className="text-md font-bold">NY Office - Dr. Tom Yen</h3>
                        <div className="text-sm text-gray-500">May 17, 2025 (10:15 AM - 12:15 PM)</div>
                      </div>
                      <div>
                        <Badge className="text-md bg-red-500 text-white hover:bg-red-500 ml-auto">In-Person</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </CardDescription>
            </div>
          )}
          {/* <CardDescription className="flex justify-between items-center cursor-pointers group/item rounded-md">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> No upcoming visits
            </div>
          </CardDescription> */}
        </div>
      </CardContent>
    </Card>
  );
}
