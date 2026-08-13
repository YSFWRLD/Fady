import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Tajawal, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const baloo = Baloo_Bhaijaan_2({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-plex",
  display: "swap",
});

/**
 * SHR-005: Open Graph metadata is generic on purpose. A shared plan or invite
 * link must never leak the group name, plan title, time, or location.
 */
export const metadata: Metadata = {
  title: "فاضي؟",
  description: "فاضي؟ يخليك تعرف متى أصحابك فاضين وتتفقون على وش تسوون.",
  openGraph: {
    title: "فاضي؟",
    description: "اعرف متى أصحابك فاضين واتفقوا على الخطة.",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FFFDFB",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme="light"
      className={`${baloo.variable} ${tajawal.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint. Light is the default —
            the OS preference is deliberately ignored, so a first-time visitor
            always lands on the light palette and only gets dark by choosing it
            from the toggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fady-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
