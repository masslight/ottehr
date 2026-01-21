export const PHARMACY_COLLECTION_LINK_IDS = {
  pharmacyCollection: 'pharmacy-collection',
  placesId: 'pharmacy-places-id',
  placesName: 'pharmacy-places-name',
  placesAddress: 'pharmacy-places-address',
  placesDataSaved: 'pharmacy-places-saved',
  erxPharmacyId: 'erx-pharmacy-id',
};

export type PlacesResult = {
  placesId: string;
  name: string;
  address: string;
  erxPharmacyId?: string;
};

export interface SearchPlacesInput {
  searchTerm?: string;
  placesId?: string;
}

export interface SearchPlacesOutput {
  pharmacyPlaces: PlacesResult[];
}
