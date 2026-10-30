export const PHARMACY_COLLECTION_LINK_IDS = {
  pharmacyCollection: 'pharmacy-collection',
  placesId: 'pharmacy-places-id',
  placesName: 'pharmacy-places-name',
  placesAddress: 'pharmacy-places-address',
  placesPhone: 'pharmacy-places-phone',
  placesDataSaved: 'pharmacy-places-saved',
  erxPharmacyId: 'erx-pharmacy-id',
  manualPharmacyName: 'pharmacy-name',
  manualPharmacyAddress: 'pharmacy-address',
};

/** A place's address in parts, from Google's place details. */
export type PlacesAddressComponents = {
  streetAddress: string | undefined;
  streetNumber: string | undefined;
  streetLong: string | undefined; // Pineapple Street
  streetShort: string | undefined; // Pineapple St
  city: string | undefined;
  stateLong: string | undefined; // New York
  stateShort: string | undefined; // NY
  zipCode: string | undefined;
  country: string | undefined;
};

export type PlacesResult = {
  placesId: string;
  name: string;
  address: string;
  phone?: string;
  erxPharmacyId?: string;
  /** Only from a place's details (a placesId search), for matching it to the Surescripts directory. */
  addressComponents?: PlacesAddressComponents;
};

export interface SearchPlacesInput {
  searchTerm?: string;
  locationBias?: { latitude: number; longitude: number };
  placesId?: string;
}

export interface SearchPlacesOutput {
  pharmacyPlaces: PlacesResult[];
}
