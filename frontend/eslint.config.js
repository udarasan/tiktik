import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // CLAUDE.md rule 10: components never call Supabase directly.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Import Supabase only in src/lib/supabase.ts or src/features/*/api.',
              // Types (Session, User) are fine anywhere; runtime calls stay in api/.
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/supabase.ts', 'src/features/*/api/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // shadcn components and test helpers are never hot-reloaded as pages.
    files: ['src/components/ui/**/*.tsx', 'src/test/**/*.tsx', 'src/**/*.test.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
]);
