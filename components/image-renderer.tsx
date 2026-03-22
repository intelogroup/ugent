'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImageOff } from 'lucide-react';

interface ImageRendererProps {
  content: string;
}

function MarkdownBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-1.5 text-gray-900">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 text-gray-800">{children}</h3>,
        p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ inline, children, ...props }: any) =>
          inline ? (
            <code className="bg-gray-100 text-blue-700 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
              {children}
            </code>
          ) : (
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-[13px] font-mono">
              <code {...props}>{children}</code>
            </pre>
          ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-300 pl-3 italic text-gray-600 my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-gray-200" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-sm border-collapse border border-gray-200 rounded-lg">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-200 bg-gray-50 px-3 py-1.5 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-200 px-3 py-1.5">{children}</td>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/**
 * Renders a single medical image with error handling.
 * Shows a fallback placeholder when the image file is missing or fails to load.
 */
function MedicalImage({ imageId, priority }: { imageId: string; priority: boolean }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="my-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-400">
          <ImageOff className="w-8 h-8" />
          <p className="text-xs">Image not available</p>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 p-2 text-center text-[10px] text-gray-400 font-mono">
          REFERENCE ID: {imageId}
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-video w-full max-w-2xl mx-auto">
        <Image
          src={`/extracted_images/images/${imageId}.png`}
          alt={`Textbook figure`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={priority}
          onError={() => setHasError(true)}
        />
      </div>
      <div className="bg-gray-50 p-2 text-center text-[10px] text-gray-400 font-mono">
        REFERENCE ID: {imageId}
      </div>
    </div>
  );
}

const ImageRenderer: React.FC<ImageRendererProps> = ({ content }) => {
  const imageRegex = /\[Image: ([a-zA-Z0-9_-]+)\]/g;
  const parts = content.split(imageRegex);

  if (parts.length === 1) {
    return <MarkdownBlock text={content} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          return part ? <MarkdownBlock key={`text-${index}`} text={part} /> : null;
        }
        return (
          <MedicalImage
            key={`image-${index}`}
            imageId={part}
            priority={index < 3}
          />
        );
      })}
    </div>
  );
};

export default ImageRenderer;
