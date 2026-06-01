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
  title: `Privacy Policy — ${legal.appName}`,
  description: `How ${legal.appName} collects, uses, and protects your personal data.`,
};

export default function PrivacyPolicy() {
  return (
    <article>
      <DocHeader title="Privacy Policy" />
      <ReviewNotice />

      <Section title="1. Who we are">
        <P>
          {legal.appName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by{" "}
          <Strong>{legal.operator}</Strong>, the data controller responsible for
          your personal data. You can reach us at{" "}
          <Strong>{legal.privacyEmail}</Strong> for any privacy question or to
          exercise your rights.
        </P>
        <P>
          This policy explains what we collect, why, the legal bases we rely on,
          and the choices and rights you have. It applies to{" "}
          {legal.siteUrl} and the {legal.appName} app.
        </P>
      </Section>

      <Section title="2. Information we collect">
        <UL>
          <LI>
            <Strong>Account data</Strong> — your email address and password
            (stored only as a secure hash by our authentication provider), and
            the username you choose.
          </LI>
          <LI>
            <Strong>Profile data</Strong> — anything you add to your profile,
            such as a display name, bio, and avatar image.
          </LI>
          <LI>
            <Strong>Content you create</Strong> — posts, comments, images you
            upload, likes, follows, and the communities you join or create.
          </LI>
          <LI>
            <Strong>Essential technical data</Strong> — a session cookie that
            keeps you logged in, and minimal server logs needed to operate and
            secure the service.
          </LI>
        </UL>
        <P>
          We do <Strong>not</Strong> use advertising trackers, third-party
          analytics, or behavioural profiling, and we do not build advertising
          profiles about you.
        </P>
      </Section>

      <Section title="3. How we use your data and our legal bases">
        <P>Under the GDPR we rely on the following legal bases:</P>
        <UL>
          <LI>
            <Strong>To provide the service</Strong> (performance of a contract)
            — creating your account, showing your feed, delivering posts,
            comments, and notifications.
          </LI>
          <LI>
            <Strong>To keep the service safe</Strong> (legitimate interests) —
            preventing abuse, fraud, and security incidents, and enforcing our
            Terms and Community Guidelines.
          </LI>
          <LI>
            <Strong>To comply with the law</Strong> (legal obligation) —
            responding to lawful requests and meeting our regulatory duties.
          </LI>
          <LI>
            <Strong>With your consent</Strong> — where we ask for it explicitly;
            you can withdraw consent at any time.
          </LI>
        </UL>
      </Section>

      <Section title="4. Who we share data with">
        <P>
          We do not sell your personal data. We share it only with service
          providers (&ldquo;processors&rdquo;) who help us run {legal.appName}{" "}
          under contract:
        </P>
        <UL>
          {legal.subprocessors.map((s) => (
            <LI key={s.name}>
              <Strong>{s.name}</Strong> — {s.purpose}.{" "}
              <Link
                href={s.site}
                className="text-accent hover:opacity-70"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy details
              </Link>
              .
            </LI>
          ))}
        </UL>
        <P>
          We may also disclose data if required by law, to protect our rights or
          users&rsquo; safety, or in connection with a merger or acquisition (in
          which case we will notify you).
        </P>
      </Section>

      <Section title="5. International transfers">
        <P>
          Your data may be processed on servers outside your country, including
          in regions operated by our providers. Where data leaves the UK/EEA, we
          rely on appropriate safeguards such as the European Commission&rsquo;s
          Standard Contractual Clauses.
        </P>
      </Section>

      <Section title="6. How long we keep it">
        <P>
          We keep your account and content for as long as your account is
          active. When you delete your account, we delete your profile, posts,
          comments, likes, follows, and uploaded images. Limited records may be
          retained where the law requires, or in backups that are rotated and
          overwritten on a routine schedule.
        </P>
      </Section>

      <Section title="7. Your rights">
        <P>
          Depending on where you live, you have some or all of the following
          rights. To exercise them, email {legal.privacyEmail} or use the tools
          in your{" "}
          <Link href="/settings" className="text-accent hover:opacity-70">
            account settings
          </Link>
          .
        </P>
        <UL>
          <LI>
            <Strong>Access</Strong> — get a copy of the data we hold about you
            (available as a one-click export in settings).
          </LI>
          <LI>
            <Strong>Rectification</Strong> — correct inaccurate data (edit your
            profile at any time).
          </LI>
          <LI>
            <Strong>Erasure</Strong> — delete your account and content (available
            in settings).
          </LI>
          <LI>
            <Strong>Portability</Strong> — receive your data in a portable,
            machine-readable format.
          </LI>
          <LI>
            <Strong>Restriction &amp; objection</Strong> — limit or object to
            certain processing.
          </LI>
          <LI>
            <Strong>Withdraw consent</Strong> — where processing is based on
            consent.
          </LI>
        </UL>
        <P>
          <Strong>EEA/UK users</Strong> may lodge a complaint with their local
          data protection authority. <Strong>California users</Strong> have the
          right to know, delete, and correct their data, and to not be
          discriminated against for exercising these rights. We do not sell or
          &ldquo;share&rdquo; personal information as defined by the CCPA/CPRA.
        </P>
      </Section>

      <Section title="8. Children">
        <P>
          {legal.appName} is not intended for children under {legal.minimumAge}.
          We do not knowingly collect data from anyone under that age. If you
          believe a child has provided us data, contact {legal.privacyEmail} and
          we will delete it.
        </P>
      </Section>

      <Section title="9. How we protect your data">
        <P>
          We use industry-standard measures including encryption in transit,
          hashed passwords, and row-level security that restricts each
          account&rsquo;s access to its own permitted data. No system is
          perfectly secure, but we work to protect your information and will
          notify you and the relevant authority of a breach where the law
          requires.
        </P>
      </Section>

      <Section title="10. Changes to this policy">
        <P>
          We may update this policy as the service evolves. We will revise the
          &ldquo;last updated&rdquo; date above and, for material changes, give
          notice in the app.
        </P>
      </Section>

      <Section title="11. Contact us">
        <P>
          Questions or requests: <Strong>{legal.privacyEmail}</Strong>. General
          enquiries: <Strong>{legal.contactEmail}</Strong>.
        </P>
      </Section>
    </article>
  );
}
