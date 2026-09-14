"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/Icons";

export default function NpxCallout() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Show feedback immediately rather than waiting on the clipboard
    // promise — it can hang indefinitely in some environments/permission
    // states, and there's no reason to block the UI on it either way.
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);

    navigator.clipboard?.writeText("npx shubhan").catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = "npx shubhan";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    });
  };

  return (
    <div className="npx-callout">
      <span className="npx-callout-prompt">$</span>
      <code>npx shubhan</code>
      <button onClick={handleCopy} className="npx-copy-btn" aria-label="Copy command" type="button">
        <CopyIcon size={15} />
        <span className="npx-copy-tooltip">{copied ? "Copied!" : "copy for a terminal surprise :3"}</span>
      </button>
    </div>
  );
}
