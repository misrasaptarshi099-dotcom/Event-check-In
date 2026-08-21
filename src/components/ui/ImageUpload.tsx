'use client';

import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';
import { uploadEventPoster } from '@/lib/firebase/storage';

export interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onClear?: () => void;
  label?: string;
  eventId?: string;
  className?: string;
}

const PRESET_BANNERS = [
  {
    name: 'Obsidian Grid',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%230F0F0F"/><path d="M0 50h800M0 100h800M0 150h800M0 200h800M0 250h800M0 300h800M0 350h800M50 0v400M100 0v400M150 0v400M200 0v400M250 0v400M300 0v400M350 0v400M400 0v400M450 0v400M500 0v400M550 0v400M600 0v400M650 0v400M700 0v400M750 0v400" stroke="%23262626" stroke-width="1"/><text x="40" y="220" fill="%23FBF9F4" font-family="monospace" font-size="28" font-weight="bold" letter-spacing="4">VOUCH // EVENT ARCHIVE</text></svg>',
  },
  {
    name: 'Brutalist Ledger',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%23FBF9F4"/><rect x="40" y="40" width="720" height="320" fill="none" stroke="%230F0F0F" stroke-width="2"/><line x1="40" y1="120" x2="760" y2="120" stroke="%230F0F0F" stroke-width="2"/><text x="60" y="90" fill="%230F0F0F" font-family="serif" font-style="italic" font-size="36">Official Concurrency Pass</text><text x="60" y="160" fill="%238C8A85" font-family="monospace" font-size="14">SYSTEM SPECIFICATION V1.0 // RFC 6238</text></svg>',
  },
  {
    name: 'Vermilion Accent',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%231C1B1B"/><rect x="0" y="0" width="800" height="12" fill="%23D93614"/><text x="40" y="210" fill="%23D93614" font-family="monospace" font-size="32" font-weight="bold" letter-spacing="6">KEYNOTE // VERIFIED</text><text x="40" y="250" fill="%238C8A85" font-family="monospace" font-size="14">ZERO DUPLICATION TOLERANCE</text></svg>',
  },
];

export function ImageUpload({
  value,
  onChange,
  onClear,
  label = 'Event Banner Image',
  eventId = 'new_event',
  className,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPEG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const url = await uploadEventPoster(file, eventId, (progress) => {
        setUploadProgress(progress);
      });
      onChange(url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload event poster.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={clsx('w-full font-mono space-y-2', className)}>
      <label className="text-[10px] uppercase tracking-widest text-muted-text font-medium block">
        {label}
      </label>

      {value ? (
        <div className="relative border border-border-rigid bg-primary overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Event Banner Preview"
            className="w-full h-44 object-cover object-center"
          />
          <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace Image
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-surface text-accent hover:bg-accent hover:text-surface"
              onClick={() => {
                onClear?.();
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : isUploading ? (
        <div className="border-2 border-dashed border-primary p-6 text-center flex flex-col items-center justify-center min-h-[140px] bg-surface-low space-y-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin" />
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Uploading & Optimizing Poster... {uploadProgress > 0 ? `${uploadProgress}%` : ''}
            </p>
            <p className="text-[10px] text-muted-text">
              Compressing image and saving to Cloud Storage
            </p>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed border-border-rigid p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center min-h-[140px]',
            isDragging ? 'bg-surface-high border-accent' : 'bg-surface-low hover:bg-surface-high'
          )}
        >
          <div className="text-2xl mb-1 text-muted-text">🖼️</div>
          <p className="text-xs uppercase tracking-wider text-primary font-medium">
            Click to upload or drag & drop banner
          </p>
          <p className="text-[10px] text-muted-text mt-1">
            Recommended: 16:9 ratio (PNG, JPG, WebP up to 10MB)
          </p>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-accent font-medium tracking-wide">
          [!] {error}
        </p>
      )}

      {/* Preset Luxury Patterns */}
      <div className="pt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-text mb-1.5">
          Or Select Preset Luxury Banner:
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_BANNERS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onChange(preset.url)}
              className="border border-border-rigid p-2 text-left bg-surface hover:bg-surface-high transition-colors rounded-none"
            >
              <div className="text-[10px] font-semibold text-primary truncate">{preset.name}</div>
              <div className="text-[9px] text-muted-text uppercase mt-0.5">Preset Design</div>
            </button>
          ))}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
          }
        }}
      />
    </div>
  );
}
