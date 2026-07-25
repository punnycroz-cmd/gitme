import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/tinyhub/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TinyHub — git-like code host",
  description:
    "TinyHub is a tiny git-like code host, rebuilt on Next.js 16. Browse, upload, search and dump your projects.",
  keywords: [
    "TinyHub",
    "git",
    "code host",
    "Next.js",
    "TypeScript",
    "shadcn/ui",
  ],
  authors: [{ name: "TinyHub" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TinyHub — git-like code host",
    description: "A tiny git-like code host, rebuilt on Next.js 16.",
    siteName: "TinyHub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TinyHub",
    description: "A tiny git-like code host, rebuilt on Next.js 16.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
