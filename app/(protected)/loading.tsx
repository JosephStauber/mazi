import { FeedSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pt-4">
      <FeedSkeleton count={5} />
    </div>
  );
}
