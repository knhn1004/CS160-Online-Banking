import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import testingLibrary from "eslint-plugin-testing-library";
import jestDom from "eslint-plugin-jest-dom";
import prettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "app/generated/**",
      "app/generated/prisma/**",
      "app/generated/prisma/wasm.js",
      "app/generated/prisma/wasm.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  eslintConfigPrettier,
  {
    plugins: {
      "testing-library": testingLibrary,
      "jest-dom": jestDom,
      prettier,
    },
    rules: {
      "prettier/prettier": ["error"],
    },
  },
];

export default eslintConfig;
