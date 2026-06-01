import type { Metadata } from "next";
import Link from "next/link";
import { legal } from "@/lib/legal/config";
import { DocHeader, Section, P, UL, LI, Strong } from "@/components/legal/doc";

export const metadata: Metadata = {
  title: `Community Guidelines — ${legal.appName}`,
  description: `What's welcome on ${legal.appName}, and what isn't.`,
};

export default function CommunityGuidelines() {
  return (
    <article>
      <DocHeader title="Community Guidelines" />

      <Section title="The short version">
        <P>
          {legal.appName} is built for genuine connection without the noise.
          Treat others with respect, share honestly, and keep this a place
          people want to be. These guidelines apply to everything you post —
          profiles, posts, comments, images, and communities.
        </P>
      </Section>

      <Section title="Not allowed">
        <UL>
          <LI>
            <Strong>Harassment &amp; hate</Strong> — attacks, slurs, or
            threats targeting people based on who they are.
          </LI>
          <LI>
            <Strong>Violence &amp; harm</Strong> — threats, incitement, or
            promotion of self-harm or violence.
          </LI>
          <LI>
            <Strong>Illegal &amp; exploitative content</Strong> — anything
            unlawful, and absolutely no sexual content involving minors.
          </LI>
          <LI>
            <Strong>Non-consensual &amp; private content</Strong> — intimate
            imagery shared without consent, or exposing others&rsquo; private
            information (doxxing).
          </LI>
          <LI>
            <Strong>Spam &amp; deception</Strong> — scams, manipulation, fake
            engagement, or impersonation.
          </LI>
        </UL>
      </Section>

      <Section title="Enforcement">
        <P>
          We may remove content and warn, suspend, or permanently remove
          accounts that break these rules. Serious violations — especially those
          involving the safety of minors — may be reported to the authorities.
          Our decisions aim to be fair and proportionate.
        </P>
      </Section>

      <Section title="Reporting">
        <P>
          A built-in way to report content is on our roadmap. In the meantime,
          if you see something that violates these guidelines, email us at{" "}
          <Strong>{legal.contactEmail}</Strong> and we will review it.
        </P>
      </Section>

      <Section title="Related">
        <P>
          These guidelines work alongside our{" "}
          <Link href="/legal/terms" className="text-accent hover:opacity-70">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-accent hover:opacity-70">
            Privacy Policy
          </Link>
          .
        </P>
      </Section>
    </article>
  );
}
