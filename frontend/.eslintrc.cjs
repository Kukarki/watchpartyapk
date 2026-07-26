module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // React Three Fiber's JSX elements (<mesh>, <meshStandardMaterial>,
      // etc.) accept three.js props (position, args, roughness, ...) that
      // aren't standard DOM/React attributes -- react/no-unknown-property
      // doesn't know about R3F's element namespace, so it flags every one
      // of them as a false positive. Scoped to just the R3F component tree.
      files: ['src/games/ludo3d/components/**/*.jsx'],
      rules: { 'react/no-unknown-property': 'off' },
    },
  ],
};
