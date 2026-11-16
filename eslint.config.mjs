import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ["app/dashboard.tsx"],
    rules: {
      // LocalStorage hydration must stay client-side to avoid SSR and hydration mismatches.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", ".next-dev/**", "out/**", "node_modules/**", "next-env.d.ts"]),
]);
