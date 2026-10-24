import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { StoreGate } from "@/components/store-gate";
import { Toaster } from "@/components/toaster";
import { HOTEL } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: `${HOTEL.name} · Property Management`,
    template: `%s · ${HOTEL.shortName}`,
  },
  description: "Hotel management system prototype with sample data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-sm">
        <StoreGate>{children}</StoreGate>
        <Toaster />
      </body>
    </html>
  );
}
