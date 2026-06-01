import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { SearchView } from "@/components/search/search-view";
import { PageHeader } from "@/components/nav/page-header";

export default async function SearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <PageHeader title="Search" />
      <div className="pt-4">
        <SearchView />
      </div>
    </div>
  );
}
