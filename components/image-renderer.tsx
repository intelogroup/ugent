'use client';

import React from 'react';
import Image from 'next/image';

interface ImageRendererProps {
  content: string;
}

const ImageRenderer: React.FC<ImageRendererProps> = ({ content }) => {
  // Regex to find occurrences of [Image: ID]
  const imageRegex = /\[Image: ([a-zA-Z0-9_-]+)\]/g;
  
  const parts = content.split(imageRegex);
  const matches = [...content.matchAll(imageRegex)];

  if (matches.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const renderedContent: React.ReactNode[] = [];
  
  parts.forEach((part, index) => {
    // Add text part
    if (part) {
      renderedContent.push(<span key={`text-${index}`} className="whitespace-pre-wrap">{part}</span>);
    }
    
    // Add image if there's a match for this gap
    if (index < matches.length) {
      const imageId = matches[index][1];
      renderedContent.push(
        <div key={`image-${index}`} className="my-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="relative aspect-video w-full max-w-2xl mx-auto">
            <Image
              src={`/extracted_images/images/${imageId}.png`}
              alt={`Textbook image ${imageId}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
          <div className="bg-gray-50 p-2 text-center text-xs text-gray-500 italic">
            Image: {imageId}
          </div>
        </div>
      );
    }
  });

  return <div className="flex flex-col gap-2">{renderedContent}</div>;
};

export default ImageRenderer;
