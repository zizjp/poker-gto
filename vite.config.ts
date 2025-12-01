import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/poker-gto/",

  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // manifest は自前の manifest.webmanifest を使うので false
      manifest: false,
      workbox: {
        // dist 配下の静的ファイルを全部キャッシュ
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ]
});
