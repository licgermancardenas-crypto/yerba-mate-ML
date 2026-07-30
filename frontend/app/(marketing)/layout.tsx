import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Yerba Mate Intelligence — Datos que no se estiman. Se verifican.",
  description:
    "Producción, consumo, comercialización y exportaciones de yerba mate en Argentina, integradas en un solo sistema con mapas geoespaciales y modelos predictivos.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>{children}</div>;
}
