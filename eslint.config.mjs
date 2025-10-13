/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import cspellESLintPluginRecommended from "@cspell/eslint-plugin/recommended";
import { fixupPluginRules } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import headers from "eslint-plugin-headers";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import eslintPluginReactRefresh from "eslint-plugin-react-refresh";
import eslintPluginTsDoc from "eslint-plugin-tsdoc";
import path from "path";
import eslintTs from "typescript-eslint";
import { fileURLToPath } from "url";

const owner = "Waldiez";
const startYear = 2024;
const spdxIdentifier = "Apache-2.0";
const currentYear = new Date().getFullYear();
const ownerAndContributors = `${owner} & contributors`;

// https://github.com/import-js/eslint-plugin-import/issues/2948#issuecomment-2148832701
const project = "./tsconfig.app.json";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: eslint.configs.recommended,
});

const legacyPlugin = (name, alias = name) => {
    // noinspection JSUnresolvedReference
    const plugin = compat.plugins(name)[0]?.plugins?.[alias];

    if (!plugin) {
        throw new Error(`Unable to resolve plugin ${name} and/or alias ${alias}`);
    }

    return fixupPluginRules(plugin);
};

const customBaseConfig = {
    ...eslint.configs.recommended,
    files: ["**/*.{ts,tsx}"], // Override default file patterns
    ignores: ["**/*.js", "**/*.mjs", "**/*.jsx"], // Explicitly ignore .js files
};

// noinspection JSCheckFunctionSignatures
const defaultConfig = eslintTs.config({
    ignores: ["node_modules", "dist", ".local", "coverage"],
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    extends: [
        customBaseConfig,
        ...eslintTs.configs.recommended,
        ...compat.extends("plugin:import/typescript"),
        eslintPluginPrettierRecommended,
        cspellESLintPluginRecommended,
    ],
    settings: {
        "import/resolver": {
            typescript: {
                alwaysTryTypes: true,
                project,
            },
            node: true,
        },
    },
    plugins: {
        "@stylistic": stylistic,
        "react-refresh": eslintPluginReactRefresh,
        import: legacyPlugin("eslint-plugin-import", "import"),
        "react-hooks": reactHooks,
        tsdoc: eslintPluginTsDoc,
        headers,
    },
    rules: {
        "prettier/prettier": [
            "error",
            {
                tabWidth: 4,
                printWidth: 110,
                arrowParens: "avoid",
                bracketSpacing: true,
                singleQuote: false,
                trailingComma: "all",
                endOfLine: "lf",
                plugins: ["@trivago/prettier-plugin-sort-imports"],
                importOrderSeparation: true,
                importOrderSortSpecifiers: true,
                importOrder: [
                    "^@fortawesome/",
                    "^@xyflow/",
                    "^react",
                    "^react-dom",
                    "^react-select",
                    "^zustand",
                    "^nanoid",
                    "^@monaco-editor/react",
                    "^@waldiez/",
                    "^[./]",
                ],
                overrides: [
                    {
                        files: ["**/*.yml", "**/*.yaml", "**/*.md", "**/*.css"],
                        options: {
                            tabWidth: 2,
                        },
                    },
                ],
            },
        ],
        "@typescript-eslint/naming-convention": [
            "error",
            {
                selector: "interface",
                format: ["PascalCase"],
                custom: {
                    regex: "^I[A-Z]",
                    match: true,
                },
            },
        ],
        "react-hooks/exhaustive-deps": "warn",
        "react-hooks/rules-of-hooks": "error",
        "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                args: "all",
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_",
            },
        ],
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@stylistic/no-explicit-any": "off",
        "@stylistic/no-trailing-spaces": "off",
        "@stylistic/padded-blocks": "off",
        "@stylistic/function-paren-newline": "off",
        "@stylistic/no-use-before-define": "off",
        "@stylistic/quotes": [
            "error",
            "double",
            {
                avoidEscape: true,
                allowTemplateLiterals: "never",
            },
        ],
        curly: ["error", "all"],
        eqeqeq: "error",
        "prefer-arrow-callback": "error",
        "tsdoc/syntax": "warn",
        complexity: ["error", 20],
        "max-depth": ["error", 4],
        "max-nested-callbacks": ["error", 4],
        "max-statements": ["error", 15, { ignoreTopLevelFunctions: true }],
        "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
        "max-lines-per-function": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
        "headers/header-format": [
            "error",
            {
                source: "string",
                content: "{licenseLine}\n{copyRightLine}",
                variables: {
                    licenseLine: `SPDX-License-Identifier: ${spdxIdentifier}`,
                    copyRightLine: `Copyright ${startYear} - ${currentYear} ${ownerAndContributors}`,
                },
            },
        ],
        "@cspell/spellchecker": [
            "warn",
            {
                configFile: "cspell.json",
            },
        ],
    },
});

export default [
    {
        ignores: [
            "node_modules",
            "dist",
            "out",
            "lib",
            "public",
            ".local",
            "**/assets/**",
            "**/.venv/**",
            "**/.tox/**",
            "**/.hatch/**",
            "**/*.js",
        ],
    },
    ...defaultConfig.map(config => ({
        ...config,
        files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}", "__mocks__/**/*.{ts,tsx}"],
        ignores: ["node_modules", "dist", ".local", "coverage"],
    })),
    // overrides
    ...defaultConfig.map(config => ({
        ...config,
        files: ["src/tests/**/*.{ts,tsx}"],
        ignores: ["node_modules", "dist", ".local", "coverage"],
        rules: {
            ...config.rules,
            "max-statements": "off",
            "max-lines": "off",
            "max-lines-per-function": "off",
        },
    })),
    // ...defaultConfig.map(config => ({
    //     ...config,
    // }))
];
