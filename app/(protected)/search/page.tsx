import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { SearchView } from "@/components/search/search-view";

export default async function SearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Search</h1>
      <SearchView />
    </div>
  );
}
