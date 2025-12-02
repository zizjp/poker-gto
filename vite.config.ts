import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/poker-gto/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ],

  server: {
    watch: {
      usePolling: true,     // ★ Syncthing + Windows/WSL では必須
      interval: 100,        // ★ 100msごとに変化を監視（軽くて十分）
      binaryInterval: 300,  // バイナリ更新用の余裕
    },
    hmr: {
      overlay: true,        // エラー時に画面にオーバーレイ表示
    }
  }
});
