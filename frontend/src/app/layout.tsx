import type { Metadata } from "next";
import { ThemeProvider, ThemeScript } from "@ide/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anti-Cheat Web IDE",
  description: "Candidate coding assessment environment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
