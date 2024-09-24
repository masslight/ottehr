const Version = (): JSX.Element => {
  const { ENV, VITE_APP_SHA, VITE_APP_VERSION } = import.meta.env;

  return (
    <div>
      <p>Env: {ENV}</p>
      <p>Hash: {VITE_APP_SHA}</p>
      <p>Version: {VITE_APP_VERSION}</p>
    </div>
  );
};

export default Version;
