import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
// basic-ssl requires Vite 6+. Use mkcert for Vite 5 compatibility.
import mkcert from 'vite-plugin-mkcert';
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const enableHttps = process.env.VITE_ENABLE_HTTPS === 'true';

  return {
    server: {
      host: "::",
      port: 8083,
      https: enableHttps,
    },
    plugins: [
      react(),
      enableHttps && mkcert(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
