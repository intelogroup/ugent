'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { ImageOff, ZoomIn, X } from 'lucide-react';

export interface ImageMeta {
  caption?: string;
  source_book?: string;
  page_number?: number;
}

interface ImageCardProps {
  imageId: string;
  meta?: ImageMeta;
  /** When true, use Next.js priority loading (above-the-fold images). Default: false. */
  priority?: boolean;
}

export function ImageCard({ imageId, meta, priority = false }: ImageCardProps) {
  const [hasError, setHasError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const src = `/extracted_images/images/${imageId}.png`;

  if (hasError) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-400">
          <ImageOff className="w-8 h-8" />
          <p className="text-xs">Image not available</p>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 p-2 text-center text-[10px] text-gray-400 font-mono">
          REF: {imageId}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Card */}
      <div className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Image + zoom trigger */}
        <button
          type="button"
          className="relative w-full max-w-2xl mx-auto block group"
          aria-label="Click to zoom"
          onClick={() => dialogRef.current?.showModal()}
        >
          {/* Adaptive height — portrait figures (histology, gross path) must not be cropped */}
          <div className="relative w-full min-h-[180px] max-h-[480px]">
            <Image
              src={src}
              alt={meta?.caption ?? 'Textbook figure'}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={priority}
              onError={() => setHasError(true)}
            />
          </div>
          {/* Zoom hint overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
          </div>
        </button>

        {/* Caption + source strip */}
        {(meta?.caption || meta?.source_book) && (
          <div className="bg-gray-50 border-t border-gray-100 px-3 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {meta.caption && (
              <span className="text-xs text-gray-700 leading-snug">{meta.caption}</span>
            )}
            {meta.source_book && (
              <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                {meta.source_book}{meta.page_number ? `, p. ${meta.page_number}` : ''}
              </span>
            )}
          </div>
        )}
        {/* Fallback ID strip when no metadata */}
        {!meta?.caption && !meta?.source_book && (
          <div className="bg-gray-50 border-t border-gray-100 p-2 text-center text-[10px] text-gray-400 font-mono">
            REF: {imageId}
          </div>
        )}
      </div>

      {/* Lightbox dialog */}
      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/75 bg-transparent p-0 max-w-screen-lg w-full rounded-lg shadow-2xl"
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="relative bg-black rounded-lg overflow-hidden">
          <button
            type="button"
            className="absolute top-2 right-2 z-10 text-white bg-black/50 rounded-full p-1 hover:bg-black/80 transition-colors"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={src}
            alt={meta?.caption ?? 'Textbook figure'}
            className="w-full h-auto max-h-[85vh] object-contain"
          />
          {meta?.caption && (
            <div className="px-4 py-2 bg-black/70 text-white text-sm text-center">
              {meta.caption}
              {meta.source_book && (
                <span className="ml-2 text-xs text-gray-400">
                  — {meta.source_book}{meta.page_number ? `, p. ${meta.page_number}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
