import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/ui/theme";
import { ToastProvider } from "@/components/ui/toast";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { PrivateAnalytics } from "@/components/providers/analytics";
import { getToken } from "@/lib/auth-server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

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

// Canonical links are set per public page, not here: a root canonical would be
// inherited by every page and point them all at "/".
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Seeds the Convex client with the session's JWT so the first render is
  // already authenticated (no signed-out flash).
  const token = await getToken();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${bodySans.variable} ${displaySerif.variable} font-sans antialiased`}
      >
        <ConvexClientProvider initialToken={token}>
          <ThemeProvider>
            <ToastProvider>
              {children}
              <CookieNotice />
            </ToastProvider>
          </ThemeProvider>
        </ConvexClientProvider>
        <PrivateAnalytics />
      </body>
    </html>
  );
}
