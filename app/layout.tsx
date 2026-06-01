import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/ui/theme";
import { ToastProvider } from "@/components/ui/toast";
import { CookieNotice } from "@/components/legal/cookie-notice";

const displaySerif = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});

const bodySans = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mazi — Privacy-first social",
  description:
    "A minimalist, privacy-first social platform. No algorithm. No ads. Just people.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${bodySans.variable} ${displaySerif.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <ToastProvider>
            {children}
            <CookieNotice />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
