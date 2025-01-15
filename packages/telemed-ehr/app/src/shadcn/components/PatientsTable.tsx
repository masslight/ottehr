import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, MoreHorizontal } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Patient, RelatedPerson } from 'fhir/r4';
import { convertFhirNameToDisplayName, getLatestAppointment, standardizePhoneNumber } from '../../../../../ehr-utils';
import { useApiClients } from '../../hooks/useAppClients';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInitials } from '@/lib/utils';
import { formatISODateToLocaleDate } from '@/helpers/formatDateTime';
import { Skeleton } from '@/components/ui/skeleton';

export const columns: ColumnDef<Patient>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      // Add the Link component here
      const name = row.getValue('name') as string;
      const initials = getInitials(name);

      return (
        <div className="text-black flex items-center gap-4">
          <Avatar className="w-8 h-8">
            <AvatarImage src={`https://randomuser.me/api/portraits/med/men/${Math.floor(Math.random() * 100)}.jpg`} />
            <AvatarFallback className="bg-blue-50 text-black">{initials}</AvatarFallback>
          </Avatar>

          <span className="font-bold">{name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'dob',
    header: 'Date of Birth',
    cell: ({ row }) => {
      const date = new Date(row.getValue('dob'));
      return <div>{date.toLocaleDateString()}</div>;
    },
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
  },
  {
    accessorKey: 'lastVisit',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Last Visit
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const lastVisit = row.getValue('lastVisit') as string;
      return lastVisit ? (
        <div className="flex items-center">
          <div>{formatISODateToLocaleDate(lastVisit)}</div>
        </div>
      ) : (
        <div className="flex items-center justify-center text-black/40"> No visits </div>
      );
    },
  },
  {
    accessorKey: 'lastOffice',
    header: 'Last Office',
    cell: ({ row }) => {
      const lastOffice = row.getValue('lastOffice') as string;
      return lastOffice ? <div>{lastOffice}</div> : <div>No office</div>;
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const patient = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(patient.id)}>
              Copy patient ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View patient details</DropdownMenuItem>
            <DropdownMenuItem>View medical history</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface PatientsTableProps {
  fhirPatients: Patient[] | null;
  relatedPersons: RelatedPerson[] | null;
  total: number;
  patientsLoading: boolean;
}

interface PatientRow {
  id: string | undefined;
  patient: string | undefined;
  dateOfBirth: string | undefined;
  phone: string | undefined;
  lastVisit?: string;
  lastOffice?: string;
}

export function PatientTable({ fhirPatients, relatedPersons, total, patientsLoading }: PatientsTableProps) {
  const { fhirClient } = useApiClients();

  const [patientRows, setPatientRows] = useState<PatientRow[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState<boolean>(false);

  // OLD
  // Get all info for patient rows
  // useEffect(() => {
  //   async function setPatientRowInfo(fhirPatients: Patient[] | null): Promise<void> {
  //     if (!fhirPatients) {
  //       setPatientRows(null);
  //       return;
  //     }

  //     setRowsLoading(true);
  //     const appointmentRequests: BatchInputGetRequest[] = [];

  //     // Get patient name, DOB
  //     const patientInfo = fhirPatients.reduce((accumulator: PatientRow[], fhirPatient) => {
  //       const selectedTags = [OTTEHR_MODULE.UC, OTTEHR_MODULE.TM].join(',');
  //       appointmentRequests.push({
  //         method: 'GET',
  //         url: `/Appointment?_tag=${selectedTags}&actor=Patient/${fhirPatient.id}&_has:Encounter:appointment:status=finished&_elements=participant,start&_sort=-date&_count=1`,
  //       });

  //       accumulator.push({
  //         id: fhirPatient.id,
  //         patient: fhirPatient.name && convertFhirNameToDisplayName(fhirPatient.name[0]),
  //         dateOfBirth: fhirPatient.birthDate,
  //         phone: standardizePhoneNumber(
  //           relatedPersons
  //             ?.find((rp) => rp.patient.reference === `Patient/${fhirPatient.id}`)
  //             ?.telecom?.find((telecom) => telecom.system === 'phone')?.value,
  //         ),
  //       });

  //       return accumulator;
  //     }, []);

  //     // Search for last appointments
  //     const appointments: Appointment[] = [];

  //     const bundle = await fhirClient?.batchRequest({
  //       requests: appointmentRequests,
  //     });
  //     const bundleAppointments =
  //       bundle?.entry?.map((entry) => {
  //         const innerBundle = entry?.resource && (entry.resource as Bundle);
  //         return innerBundle?.entry?.[0]?.resource as Appointment;
  //       }) || [];

  //     appointments.push(...bundleAppointments);

  //     // Get the patient's last visit and last office
  //     appointments.forEach((appointment) => {
  //       if (!appointment) {
  //         return;
  //       }

  //       const patientID = appointment.participant
  //         .find((participant) => participant.actor?.reference?.startsWith('Patient'))
  //         ?.actor?.reference?.replace('Patient/', '');
  //       const locationID = appointment.participant
  //         .find((participant) => participant.actor?.reference?.startsWith('Location'))
  //         ?.actor?.reference?.replace('Location/', '');
  //       const locationResource = locations?.find((location) => location.id === locationID);
  //       const locationState = locationResource?.address?.state;
  //       const locationCity = locationResource?.address?.city;

  //       const index = patientInfo.findIndex((info) => info.id === patientID);
  //       patientInfo[index] = {
  //         ...patientInfo[index],
  //         lastVisit: appointment.start,
  //         lastOffice: locationState && locationCity && `${locationState.toUpperCase()}-${locationCity}`,
  //       };
  //     });

  //     setRowsLoading(false);
  //     setPatientRows(patientInfo);
  //   }

  //   setPatientRowInfo(fhirPatients)
  //     .catch((error) => console.log(error))
  //     .finally(() => setRowsLoading(false));
  // }, [fhirClient, fhirPatients, locations, relatedPersons]);

  // NEW
  useEffect(() => {
    async function setPatientRowInfo(fhirPatients: Patient[] | null): Promise<void> {
      if (!fhirPatients) {
        setPatientRows(null);
        return;
      }

      setRowsLoading(true);

      // Get latest appointments for all patients in parallel
      const appointmentPromises = fhirPatients.map((patient) => getLatestAppointment(fhirClient!, patient.id!));

      const appointments = await Promise.all(appointmentPromises);

      // console.log(appointments);

      // Map patient info with their appointments
      const patientInfo = fhirPatients.map((fhirPatient, index) => {
        const latestAppointment = appointments[index];

        return {
          id: fhirPatient.id,
          patient: fhirPatient.name && convertFhirNameToDisplayName(fhirPatient.name[0]),
          dateOfBirth: fhirPatient.birthDate,
          phone: standardizePhoneNumber(
            relatedPersons
              ?.find((rp) => rp.patient.reference === `Patient/${fhirPatient.id}`)
              ?.telecom?.find((telecom) => telecom.system === 'phone')?.value,
          ),
          lastVisit: latestAppointment?.appointment.start,
          lastOffice: latestAppointment?.includedResources[0]?.name,
        };
      });

      setRowsLoading(false);
      setPatientRows(patientInfo);
    }

    setPatientRowInfo(fhirPatients)
      .catch((error) => console.log(error))
      .finally(() => setRowsLoading(false));
  }, [fhirClient, fhirPatients, relatedPersons]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const tableData = React.useMemo(() => {
    if (!patientRows) return [];

    return patientRows.map((row) => ({
      id: row.id || '',
      name: row.patient || '',
      dob: row.dateOfBirth || '',
      phone: row.phone || '',
      lastVisit: row.lastVisit || '',
      lastOffice: row.lastOffice || '',
    }));
  }, [patientRows]);

  const table = useReactTable({
    data: tableData, // Use the transformed data instead of static data
    columns,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const isLoading = rowsLoading || patientsLoading;

  /** TEST: Fetcing latest appointment for a patient  */
  // useEffect(() => {
  //   async function fetchLatestAppointment() {
  //     if (fhirClient && fhirPatients?.[0]?.id) {
  //       const appointment = await getLatestAppointment(fhirClient, '022644bd-38c0-4c79-a6be-eaf27c879ebc');
  //       console.log('Latest appointment:', appointment);
  //       console.log('Latest visit:', formatISODateToLocaleDate(appointment?.appointment.start));
  //       console.log('Latest office:', appointment?.includedResources[0]?.name);
  //     }
  //   }

  //   fetchLatestAppointment().catch(console.error);
  // }, [fhirClient, fhirPatients]);

  return (
    <div className="w-full ">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter name..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <Link to={`/patient/${row.original.id}`} className="block -m-4 p-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Link>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          )}
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
          selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <TableBody>
      {[...Array(10)].map((row) => (
        <TableRow key={row}>
          <TableCell>
            <Skeleton className="my-1 bg-gray-200 h-5 w-5" />
          </TableCell>
          {[...Array(5)].map((cell) => (
            <TableCell key={cell}>
              <Skeleton
                className="bg-gray-200 h-5"
                style={{ width: `${Math.floor(Math.random() * (200 - 100 + 1)) + 100}px` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
