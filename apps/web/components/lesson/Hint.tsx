import { ChevronDown, Lightbulb } from 'lucide-react';
import { Markdown } from './Markdown';

export function Hint({ markdown, label = 'Hint' }: { markdown: string; label?: string }) {
  return (
    <details className="group rounded-xl bg-panel">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-5 text-lg font-bold select-none [&::-webkit-details-marker]:hidden">
        <Lightbulb className="size-6 text-muted" aria-hidden />
        {label}
        <ChevronDown
          className="ml-auto size-5 text-muted transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="prose-shire px-6 pb-6">
        <Markdown>{markdown}</Markdown>
      </div>
    </details>
  );
}
