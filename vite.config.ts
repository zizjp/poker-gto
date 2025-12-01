import { defineConfig } from "vite";

export default defineConfig({
  base: "/poker-gto/", // ← GitHub Pages でのサブパス（リポ名に合わせる）
  build: {
    outDir: "docs"      // ← GitHub Pages 用に docs に出力
  }
});
