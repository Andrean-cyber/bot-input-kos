import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Konfigurasi lain jika ada tetap biarkan di sini */

  experimental: {
    serverActions: {
      bodySizeLimit: "20mb", // Jalur yang benar sesuai modul eksperimental Next.js Anda
    },
  },
};

export default nextConfig;