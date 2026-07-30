import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 default es solo [75] (breaking change) -- la landing pide
    // explícitamente quality 85-90 para las fotos del hero/spotlight, sin
    // esto next/image coercionaba en silencio a 75 sin avisar. Ver
    // node_modules/next/dist/docs/.../version-16.md "qualities Default".
    qualities: [75, 80, 85, 88, 90],
  },
};

export default nextConfig;
