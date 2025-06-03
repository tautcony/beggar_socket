import pluginVue from 'eslint-plugin-vue'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'

const commonTsRules = {
  'no-undef': 'off',
  'no-extra-semi': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/no-var-requires': 'error',
  '@stylistic/no-trailing-spaces': 'error',
  '@stylistic/indent': ['error', 2],
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/comma-dangle': ['error', 'always-multiline'],
  '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
  '@stylistic/space-before-function-paren': ['error', {
    anonymous: 'always',
    named: 'never',
    asyncArrow: 'always'
  }],
  '@stylistic/space-infix-ops': 'error',
  '@stylistic/keyword-spacing': ['error', {
    before: true,
    after: true
  }],
  '@stylistic/array-bracket-spacing': ['error', 'never'],
  '@stylistic/object-curly-spacing': ['error', 'always'],
  '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
  '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
  'no-duplicate-imports': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
  'eqeqeq': ['error', 'always'],
  'no-redeclare': 'error',
  'no-shadow': 'error',
  'no-throw-literal': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
  'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
  'no-multi-spaces': 'error',
  'no-mixed-spaces-and-tabs': 'error',
}

export default [
  // TypeScript files configuration
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@stylistic': stylistic
    },
    rules: {
      ...commonTsRules,
    }
  },
  // Vue files configuration
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@stylistic': stylistic
    },
    rules: {
      // Vue specific rules
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/no-multiple-template-root': 'off', // Vue 3 allows multiple root elements
      
      // TypeScript rules for Vue files
      ...commonTsRules,
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
]
