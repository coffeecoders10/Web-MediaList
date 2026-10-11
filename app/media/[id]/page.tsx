import { Suspense } from "react";
import { MediaDetail } from "@/components/detail/MediaDetail";
import seed from "@/lib/media/seed.json";

// Entries you add yourself live in the browser, so only the sample ids are prerendered.
// Any other id is rendered on demand and looked up client-side.
export function generateStaticParams() {
  return seed.map(({ id }) => ({ id }));
}

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
