import { Suspense } from "react";
import { RandomCovers } from "./RandomCovers";

export function AuthCovers() {
  return (
    <Suspense fallback={null}>
      <RandomCovers />
    </Suspense>
  );
}
