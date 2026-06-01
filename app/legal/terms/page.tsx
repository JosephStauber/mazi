import type { Metadata } from "next";
import Link from "next/link";
import { legal } from "@/lib/legal/config";
import {
  DocHeader,
  Section,
  P,
  UL,
  LI,
  Strong,
  ReviewNotice,
} from "@/components/legal/doc";

export const metadata: Metadata = {
  title: `Terms of Service — ${legal.appName}`,
  description: `The rules for using ${legal.appName}.`,
};

export default function TermsOfService() {
  return (
    <article>
      <DocHeader title="Terms of Service" />
      <ReviewNotice />

      <Section title="1. Agreement">
        <P>
          These Terms are a binding agreement between you and{" "}
          <Strong>{legal.operator}</Strong> (&ldquo;{legal.appName}&rdquo;,
          &ldquo;we&rdquo;). By creating an account or using the service, you
          agree to these Terms and to our{" "}
          <Link href="/legal/privacy" className="text-accent hover:opacity-70">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/legal/guidelines" className="text-accent hover:opacity-70">
            Community Guidelines
          </Link>
          . If you do not agree, do not use {legal.appName}.
        </P>
      </Section>

      <Section title="2. Eligibility">
        <P>
          You must be at least {legal.minimumAge} years old to use{" "}
          {legal.appName}. By using the service you confirm that you meet this
          requirement and that the information you provide is accurate. You are
          responsible for keeping your login credentials secure and for activity
          under your account.
        </P>
      </Section>

      <Section title="3. Your content">
        <P>
          You keep ownership of the posts, comments, and images you create
          (&ldquo;your content&rdquo;). To operate the service, you grant us a
          non-exclusive, worldwide, royalty-free licence to host, store,
          reproduce, and display your content solely to provide and improve{" "}
          {legal.appName}. This licence ends when you delete your content or
          account, except for copies retained in routine backups or where the
          law requires.
        </P>
        <P>
          You are responsible for your content and confirm you have the rights
          to share it.
        </P>
      </Section>

      <Section title="4. Acceptable use">
        <P>You agree not to:</P>
        <UL>
          <LI>break the law or infringe others&rsquo; rights;</LI>
          <LI>
            post content that is illegal, hateful, harassing, threatening, or
            sexually exploitative — see our Community Guidelines;
          </LI>
          <LI>
            impersonate others, spam, or attempt to gain unauthorised access to
            accounts or systems;
          </LI>
          <LI>
            scrape, reverse-engineer, or disrupt the service or its
            infrastructure.
          </LI>
        </UL>
      </Section>

      <Section title="5. Moderation and termination">
        <P>
          We may remove content or suspend or terminate accounts that violate
          these Terms or our Community Guidelines, or where required by law. You
          may stop using {legal.appName} and delete your account at any time from
          your{" "}
          <Link href="/settings" className="text-accent hover:opacity-70">
            settings
          </Link>
          .
        </P>
      </Section>

      <Section title="6. Disclaimers">
        <P>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, to the fullest extent
          permitted by law. We do not guarantee that the service will be
          uninterrupted, error-free, or secure, and we are not responsible for
          content posted by other users.
        </P>
      </Section>

      <Section title="7. Limitation of liability">
        <P>
          To the fullest extent permitted by law, {legal.appName} and its
          operator will not be liable for indirect, incidental, special, or
          consequential damages, or for loss of data, profits, or goodwill
          arising from your use of the service. Nothing in these Terms limits
          liability that cannot be limited under applicable law (such as for
          death or personal injury caused by negligence).
        </P>
      </Section>

      <Section title="8. Governing law">
        <P>
          These Terms are governed by the laws of{" "}
          <Strong>{legal.governingLaw}</Strong>, and disputes will be subject to
          the exclusive jurisdiction of <Strong>{legal.jurisdiction}</Strong>,
          except where mandatory consumer-protection law in your country of
          residence provides otherwise.
        </P>
      </Section>

      <Section title="9. Changes">
        <P>
          We may update these Terms from time to time. We will update the date
          above and, for material changes, notify you in the app. Continued use
          after changes take effect means you accept them.
        </P>
      </Section>

      <Section title="10. Contact">
        <P>
          Questions about these Terms: <Strong>{legal.contactEmail}</Strong>.
        </P>
      </Section>
    </article>
  );
}
