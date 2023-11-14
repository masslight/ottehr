// TODO This file should be deleted when we finish hooking up the front end with the back end
export const getPatients = (): any => [
  {
    encounterId: '0b669dc1-ad4c-43c2-84f1-c010400889e2',
    firstName: 'John',
    lastName: 'Doe',
    queuedTime: '2023-09-29T08:15:00Z',
    roomName: 'testRoom',
  },
  {
    encounterId: '0b669dc1-ad4c-43c2-84f1-c010400889e2',
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
