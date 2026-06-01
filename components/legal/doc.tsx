import { legal } from "@/lib/legal/config";

export function DocHeader({ title }: { title: string }) {
  return (
    <header className="mb-10 border-b border-border pb-8">
      <h1 className="brand text-4xl leading-tight text-foreground sm:text-5xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated {legal.effectiveDate}
      </p>
    </header>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24 first:mt-0">
      <h2 className="brand text-2xl text-foreground">{title}</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-1 space-y-2">
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

/** Highlighted notice that the text is a template needing legal review. */
export function ReviewNotice() {
  return (
    <div className="mb-10 rounded-[var(--radius-md)] border border-border-strong bg-accent-muted px-4 py-3 text-sm text-foreground">
      <strong className="font-semibold">Template — review before launch.</strong>{" "}
      This document is a good-faith starting point, not legal advice. Replace
      the placeholder details and have it reviewed by a qualified lawyer for
      your jurisdiction.
    </div>
  );
}
