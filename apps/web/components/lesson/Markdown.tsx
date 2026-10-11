import type { Element, ElementContent } from 'hast';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { CopyButton } from './CopyButton';

function textOf(node: Element | ElementContent): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) return node.children.map(textOf).join('');
  return '';
}

/** Lesson prose. Static code blocks get syntax highlighting and a copy button. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
      components={{
        pre: ({ node, children: code }) => (
          <div className="group relative">
            <pre className="rounded-xl bg-panel px-6 py-5 pr-14">{code}</pre>
            {node && (
              <CopyButton
                text={textOf(node).replace(/\n$/, '')}
                className="absolute top-3 right-3"
              />
            )}
          </div>
        ),
        a: ({ href, children: label }) => (
          <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            {label}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
