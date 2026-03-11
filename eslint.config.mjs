import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-function': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '__mocks__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    }
  },
  {
    ignores: ['node_modules/', 'main.js', 'dist/', 'coverage/', 'obsidian-releases/'],
  }
);
