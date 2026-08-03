import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed on Vercel at the domain root. SITE_BASE overrides for any
// subpath host (e.g. SITE_BASE=/tcg-market/ for GitHub Pages).
export default defineConfig({
  plugins: [react()],
  base: process.env.SITE_BASE || "/",
});
