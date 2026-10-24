import { Suspense } from "react";
import { GuestProfile } from "@/components/guest-profile";

export default function GuestProfilePage() {
  return (
    <Suspense fallback={null}>
      <GuestProfile />
    </Suspense>
  );
}
