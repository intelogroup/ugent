'use client';

import React from 'react';
import Image from 'next/image';

interface ImageRendererProps {
  content: string;
}

const ImageRenderer: React.FC<ImageRendererProps> = ({ content }) => {
  // Regex to find occurrences of [Image: ID] - using a capturing group
  const imageRegex = /\[Image: ([a-zA-Z0-9_-]+)\]/g;
  
  // split with capturing group returns [text, id, text, id, text]
  const parts = content.split(imageRegex);

  if (parts.length === 1) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, index) => {
        // Even indices are text parts, odd indices are the captured IDs
        if (index % 2 === 0) {
          return part ? (
            <span key={`text-${index}`} className="whitespace-pre-wrap">
              {part}
            </span>
          ) : null;
        } else {
          const imageId = part;
          return (
            <div key={`image-${index}`} className="my-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="relative aspect-video w-full max-w-2xl mx-auto">
                <Image
                  src={`/extracted_images/images/${imageId}.png`}
                  alt={`Textbook image ${imageId}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={index < 3} // Priority for first few images
                />
              </div>
              <div className="bg-gray-50 p-2 text-center text-[10px] text-gray-400 font-mono">
                REFERENCE ID: {imageId}
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default ImageRenderer;
