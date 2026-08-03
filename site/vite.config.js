import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed at https://lucs2k.github.io/tcg-market/
export default defineConfig({
  plugins: [react()],
  base: "/tcg-market/",
});
