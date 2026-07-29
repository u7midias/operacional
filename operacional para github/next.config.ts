import type { NextConfig } from "next";

// basePath é necessário porque o GitHub Pages publica um "project site" em
// https://<usuário>.github.io/<repo>/ — não na raiz do domínio. Deixe vazio
// (NEXT_BASE_PATH não definido) ao rodar em Vercel/Netlify ou domínio próprio.
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
