import type { Metadata } from "next";
import Link from "next/link";
import { legal } from "@/lib/legal/config";
import { DocHeader, Section, P, UL, LI, Strong } from "@/components/legal/doc";

export const metadata: Metadata = {
  title: `Cookie Notice — ${legal.appName}`,
  description: `${legal.appName} uses only essential cookies — no tracking or advertising.`,
};

export default function CookieNotice() {
  return (
    <article>
      <DocHeader title="Cookie Notice" />

      <Section title="We only use essential cookies">
        <P>
          {legal.appName} does not use advertising or tracking cookies, and we
          do not run third-party analytics. Because the cookies we use are
          strictly necessary to provide a service you asked for, we do not need
          to ask for consent to set them — but we want to be transparent about
          what they do.
        </P>
      </Section>

      <Section title="What we set">
        <UL>
          <LI>
            <Strong>Authentication / session cookies</Strong> — set by our
            authentication provider to keep you securely signed in and to
            protect against cross-site request forgery. Without these, you could
            not stay logged in.
          </LI>
        </UL>
      </Section>

      <Section title="Local storage on your device">
        <P>
          We also use your browser&rsquo;s local storage to remember in-app
          preferences such as your light/dark theme and notification toggles.
          This data stays on your device and is not sent to us for tracking.
        </P>
      </Section>

      <Section title="Managing cookies">
        <P>
          You can clear or block cookies in your browser settings, but blocking
          essential cookies will prevent you from signing in. For more on how we
          handle data, see our{" "}
          <Link href="/legal/privacy" className="text-accent hover:opacity-70">
            Privacy Policy
          </Link>
          .
        </P>
      </Section>
    </article>
  );
}
