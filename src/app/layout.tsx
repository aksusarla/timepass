import type { Metadata, Viewport } from "next";
import Analytics from "@/components/Analytics";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timepass Movie Games",
  description:
    "Original movie games for Indian get-togethers, in Telugu and Tamil. No install, no login. Open the link and play.",
  openGraph: {
    title: "Timepass Movie Games",
    description: "Original movie games for Indian get-togethers. No install, no login.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

// Applies a saved light/dark choice before first paint (same behaviour as
// the portfolio's theme switch).
const themeInit = `try{var t=localStorage.getItem('timepass:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="claude:viewport-fit-sides" content="cover" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300..900;1,300..900&family=Noto+Sans+Tamil:wght@400..800&family=Noto+Sans+Telugu:wght@400..800&display=swap"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
