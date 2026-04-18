// src/app/find-your-frame/page.tsx
import FindYourFrameClient from "./FindYourFrameClient";

export const dynamic = "force-dynamic";

export default function FindYourFramePage() {
  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <FindYourFrameClient />
      </div>
    </div>
  );
}