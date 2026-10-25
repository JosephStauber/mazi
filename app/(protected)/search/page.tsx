import { SearchView } from "@/components/search/search-view";
import { PageHeader } from "@/components/nav/page-header";

export default function SearchPage() {
  // The protected layout already guarantees a full-access session.
  return (
    <div>
      <PageHeader title="Search" />
      <div className="pt-4">
        <SearchView />
      </div>
    </div>
  );
}
