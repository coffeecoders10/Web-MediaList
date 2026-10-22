import { Suspense } from "react";
import { MediaDetail } from "@/components/detail/MediaDetail";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MediaDetail id={id} />;
}

export default function ProfileMediaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  );
}
