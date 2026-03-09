/* eslint-env node */
module.exports = {
  env: {
    node: true,   // Node.js globals like require and module
    es6: true,    // ES6 features
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { "allowTemplateLiterals": true }],
    "no-unused-vars": ["warn", { "varsIgnorePattern": "^logger$" }] // ignore unused logger
  },
  globals: {
    module: "readonly",   // explicitly define module global
    exports: "readonly"   // explicitly define exports global
  }
};