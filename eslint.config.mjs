import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-function': 'off',
      'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
      '@typescript-eslint/require-await': 'error',
      
      // Obsidian Plugin Rules
      'obsidianmd/commands/no-command-in-command-id': 'error',
      'obsidianmd/commands/no-command-in-command-name': 'error',
      'obsidianmd/commands/no-default-hotkeys': 'error',
      'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
      'obsidianmd/commands/no-plugin-name-in-command-name': 'error',
      'obsidianmd/settings-tab/no-manual-html-headings': 'error',
      'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',
      'obsidianmd/vault/iterate': 'error',
      'obsidianmd/detach-leaves': 'error',
      'obsidianmd/hardcoded-config-path': 'error',
      'obsidianmd/no-forbidden-elements': 'error',
      'obsidianmd/no-plugin-as-component': 'error',
      'obsidianmd/no-sample-code': 'error',
      'obsidianmd/no-tfile-tfolder-cast': 'error',
      'obsidianmd/no-view-references-in-plugin': 'error',
      'obsidianmd/no-static-styles-assignment': 'error',
      'obsidianmd/object-assign': 'error',
      'obsidianmd/platform': 'error',
      'obsidianmd/prefer-abstract-input-suggest': 'error',
      'obsidianmd/prefer-file-manager-trash-file': 'error',
      'obsidianmd/regex-lookbehind': 'error',
      'obsidianmd/sample-names': 'error',
      'obsidianmd/validate-manifest': 'error',
      'obsidianmd/validate-license': 'error',
      'obsidianmd/ui/sentence-case': ['error', {
        brands: ['Gemini', 'Google', 'AI'],
      }],
    },
  },
  {
    files: ['**/*.test.ts', '__mocks__/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
    }
  },
  {
    ignores: ['node_modules/', 'main.js', 'dist/', 'coverage/', 'obsidian-releases/'],
  }
);
