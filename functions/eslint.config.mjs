import globals from "globals";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    resolvePluginsRelativeTo: __dirname
});

export default [
    js.configs.recommended,
    ...compat.extends("google").map(config => {
        if (config.rules) {
            delete config.rules["valid-jsdoc"];
            delete config.rules["require-jsdoc"];
        }
        return config;
    }),
    {
        languageOptions: {
            ecmaVersion: 2018,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.es6,
            },
        },
        rules: {
            "linebreak-style": 0,
            "no-restricted-globals": ["error", "name", "length"],
            "prefer-arrow-callback": "error",
            "quotes": ["error", "double", { "allowTemplateLiterals": true }],
        },
    },
    {
        files: ["**/*.spec.*"],
        languageOptions: {
            globals: {
                ...globals.mocha,
            },
        },
        rules: {},
    },
];
