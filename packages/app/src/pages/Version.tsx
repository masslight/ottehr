const Version = (): JSX.Element => {
  const { REACT_APP_ENV, REACT_APP_SHA, REACT_APP_VERSION } = process.env;

  return (
    <div>
      <p>
        Env:
        {REACT_APP_ENV}
      </p>
      <p>
        Hash:
        {REACT_APP_SHA}
      </p>
      <p>
        Version:
        {REACT_APP_VERSION}
      </p>
    </div>
  );
};

export default Version;
