export default [
  {
    files: ["main_code/js/**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",

      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        console: "readonly",

        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",

        fetch: "readonly",
        URL: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        TextEncoder: "readonly",

        Audio: "readonly",
        Image: "readonly",
        Notification: "readonly",

        btoa: "readonly",
        atob: "readonly",
        crypto: "readonly",

        FocusFlowShared: "writable"
      }
    },

    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  },

  {
    files: ["backend/src/**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },

    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  }
];