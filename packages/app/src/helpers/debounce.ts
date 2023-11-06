// TODO This might be a duplicate of MUI's debounce. Confirm once you get it working
export function debounce(func: (...args: any) => void, wait = 500): (...args: any) => void {
  let timeout: NodeJS.Timeout;
  function debounced(...args: any): void {
    const later = (): void => {
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  }

  debounced.clear = () => {
    clearTimeout(timeout);
  };

  return debounced;
}
