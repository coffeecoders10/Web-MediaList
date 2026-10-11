import { Suspense } from "react";
import { MediaDetail } from "@/components/detail/MediaDetail";

// Each user's collection is private and loaded per request, so there is nothing to prerender by id.
async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MediaDetail id={id} />;
}

export default function MediaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  );
}
