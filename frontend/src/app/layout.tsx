import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Web3Provider from "@/providers/Web3Provider";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import LayoutShell from "@/components/LayoutShell";

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
  title: "Grepple — Make MCP Tools Discoverable by Agents",
  description: "Diagnose, score, and publish your MCP tools. Let agents find and use them.",
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
          <ToastProvider>
            <Sidebar />
            <LayoutShell>
              {children}
            </LayoutShell>
          </ToastProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
