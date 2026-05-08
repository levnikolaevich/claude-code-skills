export default [
    {
        ignores: ["dist/**", "test/fixtures/**"],
    },
    {
        files: ["**/*.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                console: "readonly",
                process: "readonly",
                Buffer: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                URL: "readonly",
            },
        },
        rules: {},
    },
];

