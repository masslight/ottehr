import { createContext, FC, PropsWithChildren, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * Holds the DOM node of the shared admin page header's action area. Admin pages render their
 * primary CTA into it via {@link AdminHeaderActionSlot}, so every page shares one title+action row.
 */
const AdminHeaderSlotContext = createContext<HTMLElement | null>(null);

export const AdminHeaderSlotProvider = AdminHeaderSlotContext.Provider;

/**
 * Renders its children into the shared admin page header, on the same row as the page title and
 * aligned to the right. Place it anywhere inside an admin page to lift that page's primary action
 * (e.g. an "Add"/"New" button) into the common header while keeping its handler and state local.
 */
export const AdminHeaderActionSlot: FC<PropsWithChildren> = ({ children }) => {
  const container = useContext(AdminHeaderSlotContext);
  if (!container) {
    return null;
  }
  return createPortal(children, container);
};
