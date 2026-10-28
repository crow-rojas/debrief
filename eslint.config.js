import js from "@eslint/js"
import vueI18n from "@intlify/eslint-plugin-vue-i18n"
import pluginVue from "eslint-plugin-vue"
import globals from "globals"
import tseslint from "typescript-eslint"

const APP = ["app/**/*.{ts,vue}", "app/i18n/*.json"]

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".superpowers/**", "test/fixtures/**", "tmp/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  { languageOptions: { globals: globals.node } },
  {
    files: ["app/**/*.{ts,vue}"],
    languageOptions: { globals: globals.browser, parserOptions: { parser: tseslint.parser } },
    rules: { "vue/multi-word-component-names": "off" },
  },
  // The i18n plugin's configs apply to every file by default; keep them on the app and its catalogs.
  ...vueI18n.configs.recommended
    .filter((c) => !c.name?.endsWith(":yaml"))
    .map((c) => ({ ...c, files: c.name?.endsWith(":json") ? ["app/i18n/*.json"] : APP })),
  {
    name: "i18n",
    files: APP,
    settings: { "vue-i18n": { localeDir: "./app/i18n/*.json", messageSyntaxVersion: "^11.0.0" } },
    rules: {
      "@intlify/vue-i18n/no-raw-text": "error",
      "@intlify/vue-i18n/no-missing-keys": "error",
      // CLI copy (cli.*) is looked up through say("cli.…"), which the plugin cannot see.
      "@intlify/vue-i18n/no-unused-keys": [
        "error",
        { src: "./app", extensions: [".ts", ".vue"], ignores: ["/^cli\\./"] },
      ],
      "@intlify/vue-i18n/no-dynamic-keys": "off",
    },
  },
  {
    name: "no-suppressions",
    files: ["**/*.{js,mjs,ts,vue}"],
    linterOptions: { noInlineConfig: true },
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
)
