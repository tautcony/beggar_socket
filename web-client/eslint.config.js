import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import importPlugin from 'eslint-plugin-import';
import globals from 'globals'
// import eslintPluginVueScopedCSS from 'eslint-plugin-vue-scoped-css';


const commonRules = {
  '@stylistic/array-bracket-spacing': ['error', 'never'],
  '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
  '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
  '@stylistic/comma-dangle': ['error', 'always-multiline'],
  '@stylistic/eol-last': 'error',
  '@stylistic/indent': ['error', 2],
  '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
  '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
  '@stylistic/no-trailing-spaces': 'error',
  '@stylistic/object-curly-spacing': ['error', 'always'],
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
  '@stylistic/space-infix-ops': 'error',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/restrict-template-expressions': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/no-extraneous-class': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-unnecessary-condition': 'off',
  '@typescript-eslint/no-unnecessary-type-arguments': 'off',
  '@typescript-eslint/no-var-requires': 'error',
  'comma-spacing': 'error',
  'eqeqeq': ['error', 'always'],
  'import/first': 'error',
  'import/newline-after-import': 'error',
  'import/no-duplicates': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-duplicate-imports': 'error',
  'no-extra-semi': 'off',
  'no-mixed-spaces-and-tabs': 'error',
  'no-multi-spaces': 'error',
  'no-redeclare': 'error',
  'no-shadow': 'error',
  'no-throw-literal': 'error',
  'no-undef': 'off',
  'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
  'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
  'no-var': 'error',
  'prefer-const': 'error',
  'simple-import-sort/exports': 'error',
  'simple-import-sort/imports': 'error',
}

export default tseslint.config(
  // TypeScript files with type checking
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    files: [
      'src/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}'
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      '@stylistic': stylistic,
      'simple-import-sort': simpleImportSort,
      'import': importPlugin,
    },
    rules: {
      ...commonRules,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: './tsconfig.json',
        },
        node: false,
      },
    },
  },
  // Vue files configuration
  // ...eslintPluginVueScopedCSS.configs['flat/recommended'],
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      '@stylistic': stylistic,
      'simple-import-sort': simpleImportSort,
      'import': importPlugin,
    },
    rules: {
      // Vue specific rules
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/no-multiple-template-root': 'off', // Vue 3 allows multiple root elements
      
      // TypeScript rules for Vue files
      ...commonRules,
    }
  },
  // JavaScript files configuration
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': 'error',
      'no-console': 'warn'
    }
  }
)
