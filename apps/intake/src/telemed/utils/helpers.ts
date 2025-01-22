export const getPromiseWithResolvers = <R>(): {
  promise: Promise<R>;
  resolve: (result: R) => void;
  reject: (error: any) => void;
} => {
  let resolve!: (result: R) => void;
  let reject!: (error: any) => void;
  const promise = new Promise<R>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, resolve, reject };
};
