import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

// the design system's config, reduced to the rules that apply to a project with no API routes, no
// database and no server code. Same imports, same shape, same rule names.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
  {
    // the design system's own settings block, copied with its reason. Its `@/components/Image`
    // wrapper takes alt through `file={{ src, alt }}` rather than a literal attribute, so
    // jsx-a11y's alt-text rule false-positives on it. Treating it as a plain element
    // stops the rule firing on the wrapper. Avatar, which is copied verbatim, is the only
    // caller here.
    settings: {
      "jsx-a11y": {
        components: {
          Image: "div",
        },
      },
    },
    plugins: { "unused-imports": unusedImports },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "unused-imports/no-unused-imports": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);

export default eslintConfig;
