import { createApp } from "vue"
import App from "./App.vue"
import { getLanguage } from "./api.ts"
import { makeI18n } from "./i18n/index.ts"
import "./styles.css"

// The UI speaks the language the cards are written in; before pairing, the browser's.
const language = await getLanguage()
createApp(App)
  .use(makeI18n(language ?? undefined))
  .mount("#app")
