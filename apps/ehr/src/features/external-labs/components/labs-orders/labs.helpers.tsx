export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return '#E0E0E0';
    case 'received':
      return '#90CAF9';
    case 'prelim':
      return '#A5D6A7';
    case 'sent':
      return '#CE93D8';
    case 'reviewed':
      return '#81C784';
    default:
      return '#E0E0E0';
  }
};
