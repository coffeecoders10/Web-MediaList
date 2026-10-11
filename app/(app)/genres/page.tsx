import type { Metadata } from "next";
import { Suspense } from "react";
import { GenreExplorer } from "@/components/genres/GenreExplorer";

export const metadata: Metadata = { title: "Genres" };

export default function GenresPage() {
  return (
    <Suspense>
      <GenreExplorer />
    </Suspense>
  );
}
