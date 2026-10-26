import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Analytics from "@/components/Analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Timepass", template: "%s · Timepass" },
  description:
    "Desi games for get-togethers and boring afternoons. No install, just open and play.",
  openGraph: {
    title: "Timepass",
    description: "Desi games for get-togethers. No install, just open and play.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2a20c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="mx-auto w-full max-w-md px-4 pt-4 pb-2">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            time<span className="text-marigold">pass</span>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
