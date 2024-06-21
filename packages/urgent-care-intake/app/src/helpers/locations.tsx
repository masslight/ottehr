import { Location } from 'fhir/r4';

export const LOCATIONS: Location[] = [
  {
    id: '1',
    resourceType: 'Location',
    name: 'Dutchess / Hopewell Junction',
    address: {
      line: ['1983 Route 52', 'Hopewell Junction, NY 12533'],
      state: 'New York',
    },
    telecom: [
      {
        system: 'phone',
        value: '845.897.4500',
      },
      {
        system: 'fax',
        value: '845.897.4550',
      },
    ],
    hoursOfOperation: [
      {
        daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        openingTime: '12:00',
        closingTime: '00:00',
      },
      {
        daysOfWeek: ['sun'],
        openingTime: '10:00',
        closingTime: '22:00',
      },
    ],
  },
  {
    id: '2',
    resourceType: 'Location',
    name: 'North Carolina / Cary',
    address: {
      line: ['2007 Walnut Street', 'Cary, NC 27518'],
      state: 'North Carolina',
    },
    telecom: [
      {
        system: 'phone',
        value: '919.823.5437',
      },
      {
        system: 'fax',
        value: '919.823.5437',
      },
    ],
    hoursOfOperation: [
      {
        daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        openingTime: '12:00',
        closingTime: '00:00',
      },
      {
        daysOfWeek: ['sun'],
        openingTime: '10:00',
        closingTime: '00:00',
      },
    ],
  },
  {
    id: '3',
    resourceType: 'Location',
    name: 'Long Island / Carle Place',
    address: {
      line: ['181 Old Country Road', 'Carle Place, NY 11514'],
      state: 'New York',
    },
    telecom: [
      {
        system: 'phone',
        value: '516.248.5437',
      },
      {
        system: 'fax',
        value: '516.248.5452',
      },
    ],
    hoursOfOperation: [
      {
        daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        openingTime: '12:00',
        closingTime: '00:00',
      },
      {
        daysOfWeek: ['sun'],
        openingTime: '10:00',
        closingTime: '00:00',
      },
    ],
  },
];
