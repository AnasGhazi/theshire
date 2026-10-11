'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={`rounded-md p-1.5 text-muted transition-colors hover:bg-band hover:text-ink ${className}`}
      aria-label={copied ? 'Copied' : 'Copy code'}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check className="size-5 text-success" /> : <Copy className="size-5" />}
    </button>
  );
}
