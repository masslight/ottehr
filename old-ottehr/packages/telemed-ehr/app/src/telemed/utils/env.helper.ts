export const isLocalOrDevOrTestingOrTrainingEnv =
  import.meta.env.MODE === 'default' ||
  import.meta.env.MODE === 'development' ||
  import.meta.env.MODE === 'testing' ||
  import.meta.env.MODE === 'training';
