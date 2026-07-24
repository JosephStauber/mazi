"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reserve } from "@/lib/actions/reserve";
import { TIME_SLIDER, reclaimedMinutes } from "@/lib/reserve/config";
import { SurveyChips } from "./survey-chips";
import { TimeSlider } from "./time-slider";
import { PricingCards } from "./pricing-cards";
import { ReservePanel, type ReserveFields } from "./reserve-panel";
import { InvitePanel } from "./invite-panel";

// Funnel steps 0..6 form the journey; step 7 is the terminal confirmation.
const LAST_JOURNEY_STEP = 6;

type Result = {
  username: string;
  referralCode: string | null;
  needsEmailConfirmation: boolean;
};

export function ReserveFlow({ referredBy }: { referredBy?: string }) {
  const [step, setStep] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(TIME_SLIDER.default);
  const [fields, setFields] = useState<ReserveFields>({
    username: "",
    email: "",
    password: "",
    agreed: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const next = () => {
    setError(null);
    setStep((s) => s + 1);
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const toggleReason = (id: string) =>
    setReasons((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  async function submitReserve() {
    setLoading(true);
    setError(null);
    try {
      const res = await reserve({
        ...fields,
        reasons,
        dailyMinutes: minutes,
        referredBy,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult({
        username: res.username,
        referralCode: res.referralCode,
        needsEmailConfirmation: res.needsEmailConfirmation,
      });
      setStep(7);
    } catch {
      setError(
        "Something went wrong — check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const reclaimedYearDays = Math.round(
    reclaimedMinutes(minutes).year / (60 * 24)
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="brand text-2xl">
          mazi<span className="brand-dot">.</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Log in
        </Link>
      </header>

      {step <= LAST_JOURNEY_STEP && (
        <div className="mx-auto w-full max-w-lg px-5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${(step / LAST_JOURNEY_STEP) * 100}%` }}
            />
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        <div key={step} className="animate-fade-up w-full max-w-lg">
          {step === 0 && (
            <Intro
              eyebrow="No algorithm · No ads · No tracking"
              title={
                <>
                  Social, without
                  <br />
                  the <span className="italic text-accent">noise.</span>
                </>
              }
              body="Mazi is a minimalist social platform built on privacy, chronological feeds, and small communities. You decide who you follow — and you see every post, in order."
            >
              <Button variant="accent" size="lg" fullWidth onClick={next}>
                See what makes it different →
              </Button>
            </Intro>
          )}

          {step === 1 && (
            <Step
              title="A feed that respects you"
              subtitle="Three promises, and no fine print."
            >
              <div className="space-y-3">
                <Pillar
                  title="Chronological"
                  body="Posts in order, newest first. No ranking, no manipulation, no surprises."
                />
                <Pillar
                  title="Privacy-first"
                  body="No tracking, no profiling, no data selling. Your account is yours alone."
                />
                <Pillar
                  title="Small communities"
                  body="Meaningful spaces over mass broadcasting. Connection over reach."
                />
              </div>
              <Nav onNext={next} onBack={back} nextLabel="Continue" />
            </Step>
          )}

          {step === 2 && (
            <Step
              title="What wears you down about social media today?"
              subtitle="Pick anything that resonates — it shapes what Mazi becomes."
            >
              <SurveyChips selected={reasons} onToggle={toggleReason} />
              <Nav onNext={next} onBack={back} nextLabel="Continue" />
            </Step>
          )}

          {step === 3 && (
            <Step
              title="How much time does it take from you?"
              subtitle="Drag to your honest daily average."
            >
              <TimeSlider minutes={minutes} onChange={setMinutes} />
              <Nav onNext={next} onBack={back} nextLabel="Continue" />
            </Step>
          )}

          {step === 4 && (
            <Step
              title={
                <>
                  Regain your time, your data,
                  <br />
                  your <span className="italic text-accent">privacy.</span>
                </>
              }
              subtitle={`On Mazi you could reclaim about ${reclaimedYearDays} days a year — time that's yours again.`}
            >
              <ul className="space-y-2.5 text-center text-lg text-foreground">
                <li>Your attention, back in your hands.</li>
                <li>Your data, never for sale.</li>
                <li>Your feed, in your order.</li>
              </ul>
              <Nav onNext={next} onBack={back} nextLabel="I want that →" />
            </Step>
          )}

          {step === 5 && (
            <Step
              title="Free while we're building"
              subtitle="Mazi stays free through the testing period. A paid tier comes later — early members help shape it."
            >
              <PricingCards />
              <Nav onNext={next} onBack={back} nextLabel="Reserve my spot →" />
            </Step>
          )}

          {step === 6 && (
            <Step
              title="Reserve your username"
              subtitle="Lock in your handle before it's taken. We'll email you the moment Mazi opens."
            >
              <ReservePanel
                fields={fields}
                onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
                onSubmit={submitReserve}
                loading={loading}
                error={error}
              />
              <button
                type="button"
                onClick={back}
                className="mx-auto mt-4 block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Back
              </button>
            </Step>
          )}

          {step === 7 && result && (
            <InvitePanel
              username={result.username}
              referralCode={result.referralCode}
              needsEmailConfirmation={result.needsEmailConfirmation}
            />
          )}
        </div>
      </main>

      <footer className="px-5 py-6 text-center text-xs text-subtle">
        <Link href="/legal/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/legal/terms" className="hover:text-foreground">
          Terms
        </Link>
      </footer>
    </div>
  );
}

function Intro({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {eyebrow}
      </div>
      <h1 className="brand mt-7 text-balance text-5xl leading-[1.03] sm:text-6xl">
        {title}
      </h1>
      <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
        {body}
      </p>
      <div className="mt-9 w-full max-w-xs">{children}</div>
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="brand text-balance text-3xl leading-tight text-foreground sm:text-4xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mx-auto mt-2.5 max-w-md text-pretty text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <h3 className="brand text-lg text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Nav({
  onNext,
  onBack,
  nextLabel,
}: {
  onNext: () => void;
  onBack: () => void;
  nextLabel: string;
}) {
  return (
    <div className="mt-8 space-y-3">
      <Button variant="accent" size="lg" fullWidth onClick={onNext}>
        {nextLabel}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto block text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back
      </button>
    </div>
  );
}
