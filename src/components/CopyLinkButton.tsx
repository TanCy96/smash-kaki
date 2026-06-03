"use client";

import { useState } from "react";

export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded bg-emerald-600 px-3 py-2 text-sm text-white"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
