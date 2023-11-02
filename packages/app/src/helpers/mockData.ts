// TODO This file should be deleted when we finish hooking up the front end with the back end
export const getPatients = (): any => [
  {
    firstName: 'John',
    lastName: 'Doe',
    queuedTime: '2023-09-29T08:15:00Z',
    roomName: 'testRoom',
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    queuedTime: '2023-09-29T15:54:00Z',
    roomName: 'testRoom',
  },
];

export const getProvider = (): any => ({
  checkboxes: true,
  email: 'osmith@provider.com',
  firstName: 'Olivia',
  lastName: 'Smith',
  slug: 'oliviasmith',
  title: 'Dr',
});

export const getTitles = (): string[] => ['Assistant', 'Dr', 'Mr', 'Mrs', 'Ms', 'Nurse'];

export const isAvailable = (slug: string): boolean => {
  return !['aykhanahmadli', 'nathanrobinson', 'omarzubaidi', 'samiromarov'].includes(slug);
};
