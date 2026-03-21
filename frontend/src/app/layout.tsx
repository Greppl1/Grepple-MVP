import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Web3Provider from "@/providers/Web3Provider";
import Sidebar from "@/components/Sidebar";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Grepple — MCP Tool Registry",
  description: "Make your MCP tools discoverable, selectable, and callable by agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full bg-bg text-text font-sans antialiased">
        <Web3Provider>
          <Sidebar />
          <main className="ml-60 min-h-screen transition-all duration-300">
            {children}
          </main>
        </Web3Provider>
      </body>
    </html>
  );
}
