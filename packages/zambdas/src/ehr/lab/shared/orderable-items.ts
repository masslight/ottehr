import { EXTERNAL_LAB_ERROR, OrderableItemSearchResult, OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API } from 'utils';

export type OrderableItemSearch =
  | { textSearch: string }
  | { itemCodes: string[] }
  | { textSearch: string; itemCodes: string[] };

/**
 * Searches the Oystehr Labs orderable item API for tests offered by the given labs,
 * by test name and/or item code. Used by the create-order resource fetch (provider
 * typing a test name) and by the global template flows (re-resolving a saved
 * lab + test combo to a live orderable item at preview/apply time).
 */
export const getOrderableItems = async (
  labGuids: string[],
  search: OrderableItemSearch,
  m2mToken: string
): Promise<OrderableItemSearchResult[]> => {
  const labIds = labGuids.join(',');
  let cursor = '';
  let totalReturn = 0;
  const items: OrderableItemSearchResult[] = [];

  const searchParams = [`labIds=${labIds}`];

  if ('textSearch' in search) searchParams.push(`itemNames=${search.textSearch}`);
  if ('itemCodes' in search) searchParams.push(`itemCodes=${search.itemCodes.join(',')}`);

  console.log('searchParams before join', searchParams);

  do {
    const url = `${OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API}?${searchParams.join('&')}&limit=100&cursor=${cursor}`;
    console.log('check me!', url);
    const orderableItemsSearch = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${m2mToken}`,
      },
    });

    if (!orderableItemsSearch.ok)
      throw EXTERNAL_LAB_ERROR(`Failed to fetch orderable items: ${orderableItemsSearch.status}`);

    console.log(`orderable item search for search term "${search}"`);
    const response = await orderableItemsSearch.json();

    let orderableItemRes = response.orderableItems;
    if (!Array.isArray(orderableItemRes)) {
      console.error(
        `orderableItemRes was not an array. It was: ${JSON.stringify(orderableItemRes)}. Returning no orderable items`
      );
      orderableItemRes = [];
    }
    const itemsToBeReturned = orderableItemRes.length;
    console.log('This is orderableItemRes len', itemsToBeReturned);

    items.push(...(orderableItemRes as OrderableItemSearchResult[]));
    cursor = response?.metadata?.nextCursor || '';
    totalReturn += itemsToBeReturned;
    console.log('totalReturn:', totalReturn);
  } while (cursor && totalReturn <= 100); // capping at 100 so that the zambda doesn't fail. (no one is scrolling through that many anyway)
  // if we hear no complaints about the 100 return (i highly doubt we will) we can simplify this logic by getting rid of the cursor logic
  // and the do while - the first call will only ever return 100 and i suspect thats really all we need

  return items;
};
