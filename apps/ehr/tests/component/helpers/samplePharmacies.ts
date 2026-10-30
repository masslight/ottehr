import { ErxDirectoryPharmacy, ErxDirectoryQuery } from 'utils/lib/types/api/erx-search.types';
import { SearchPlacesInput, SearchPlacesOutput } from 'utils/lib/types/data/search-places';

// Google finds both sample pharmacies, and both are in the Surescripts directory.
const PLACES = [
  { placesId: 'place-one', name: 'Sample Pharmacy One', address: '123 Main St, Washington, DC', street: 'Main St' },
  {
    placesId: 'place-two',
    name: 'Sample Pharmacy Two',
    address: '123 Example St, Washington, DC',
    street: 'Example St',
  },
];

const DIRECTORY: ErxDirectoryPharmacy[] = [
  { ncpdpId: '0002026', npi: '1234567893', name: 'Sample Pharmacy One', phone: '5125559999', address1: '123 MAIN ST' },
  {
    ncpdpId: '0000031',
    npi: '1245319599',
    name: 'Sample Pharmacy Two',
    phone: '5125550123',
    address1: '123 EXAMPLE ST',
  },
].map((pharmacy) => ({ ...pharmacy, city: 'WASHINGTON', state: 'DC', zipCode: '200011234', specialties: [] }));

/** The search-places zambda: suggestions by name, and a place's details with its address parts. */
export const searchSamplePlaces = async ({ searchTerm, placesId }: SearchPlacesInput): Promise<SearchPlacesOutput> => ({
  pharmacyPlaces: searchTerm
    ? PLACES.filter((place) => place.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : PLACES.filter((place) => place.placesId === placesId).map((place) => ({
        ...place,
        addressComponents: {
          streetAddress: undefined,
          streetNumber: '123',
          streetLong: place.street,
          streetShort: place.street,
          city: 'Washington',
          stateShort: 'DC',
          stateLong: undefined,
          zipCode: '20001',
          country: undefined,
        },
      })),
});

/** The directory search, by address. */
export const searchSampleDirectory = async (
  _token: string,
  query: ErxDirectoryQuery
): Promise<ErxDirectoryPharmacy[]> =>
  DIRECTORY.filter(
    (pharmacy) => query.address && pharmacy.address1.toLowerCase().includes(query.address.toLowerCase())
  );
