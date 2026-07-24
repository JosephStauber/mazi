import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { getMyReservation, getReferralCount } from "@/lib/queries/reserve";
import { buttonClassName } from "@/components/ui/button";
import { ReferralShare } from "@/components/reserve/referral-share";

export default async function WelcomePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  const [reservation, referralCount] = await Promise.all([
    getMyReservation(),
    getReferralCount(),
  ]);

  return (
    <div className="animate-fade-up space-y-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Reserved
        </span>
        <h1 className="brand mt-4 text-3xl text-foreground">
          You&rsquo;re in, @{profile.username}.
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          Mazi is still in private testing. We&rsquo;ll email you the moment your
          spot opens.
        </p>
      </div>

      {reservation && (
        <ReferralShare
          referralCode={reservation.referral_code}
          count={referralCount}
        />
      )}

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <p className="text-sm font-semibold text-foreground">Get a head start</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your profile now so it&rsquo;s ready the day you get in.
        </p>
        <Link
          href="/welcome/profile"
          className={buttonClassName({
            variant: "outline",
            size: "md",
            className: "mt-3",
          })}
        >
          Customize your profile →
        </Link>
      </div>
    </div>
  );
}
