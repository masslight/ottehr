export const Version = (): JSX.Element => {
  const { VITE_ENV, VITE_SHA, VITE_VERSION } = import.meta.env;

  console.log(VITE_ENV);

  return (
    <div>
      <p>
        Env:
        {VITE_ENV}
      </p>
      <p>
        Hash:
        {VITE_SHA}
      </p>
      <p>
        Version:
        {VITE_VERSION}
      </p>
    </div>
  );
};
