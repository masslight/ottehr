const Version = (): JSX.Element => {
  const { VITE_APP_IS_LOCAL, VITE_APP_SHA, VITE_APP_VERSION } = import.meta.env;

  return (
    <div>
      <p>Env: {VITE_APP_IS_LOCAL ? 'local' : 'development'}</p>
      <p>Hash: {VITE_APP_SHA}</p>
      <p>Version: {VITE_APP_VERSION}</p>
    </div>
  );
};

export default Version;
