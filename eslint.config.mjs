import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];

export default config;
