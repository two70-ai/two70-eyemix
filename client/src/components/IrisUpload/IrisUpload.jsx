import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { fileToDataUrl, formatFileSize, isValidImageFile } from '../../utils/imageUtils.js';
import toast from 'react-hot-toast';

function IrisDropzone({ label, person, file, preview, onFile, disabled }) {
  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        toast.error(`Invalid file: ${rejectedFiles[0].errors[0]?.message || 'Unknown error'}`);
        return;
      }
      const f = acceptedFiles[0];
      if (!f) return;
      if (!isValidImageFile(f)) {
        toast.error('Only JPEG, PNG, and WebP images are supported');
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error('Image must be under 10MB');
        return;
      }
      const dataUrl = await fileToDataUrl(f);
      onFile(f, dataUrl);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled,
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-semibold text-slate-300">{label}</p>

      <div
        {...getRootProps()}
        className={`relative w-40 h-40 rounded-full cursor-pointer transition-all duration-300 overflow-hidden border-4 ${
          isDragReject
            ? 'border-red-500 bg-red-900/20'
            : isDragActive
            ? 'border-primary-400 bg-primary-900/30 scale-105'
            : file
            ? 'border-primary-600 shadow-glow'
            : 'border-surface-border hover:border-primary-600 hover:bg-primary-900/10'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />

        {preview ? (
          <>
            <img src={preview} alt={`${person} iris`} className="w-full h-full object-cover" />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-xs text-center font-medium">Click or drag to replace</p>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-xs text-center px-3">
              {isDragActive ? 'Drop here!' : 'Click or drag iris photo'}
            </span>
          </div>
        )}

        {/* Circular border decoration */}
        <div className="absolute inset-0 rounded-full pointer-events-none">
          <svg className="w-full h-full opacity-20" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="76" fill="none" stroke="url(#ringGrad)" strokeWidth="1" strokeDasharray="4 8" />
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {file && (
        <div className="text-center">
          <p className="text-xs text-slate-400 truncate max-w-36">{file.name}</p>
          <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onFile(null, null); }}
            className="text-xs text-red-400 hover:text-red-300 mt-1 transition-colors"
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function IrisUpload({ onFilesChange, disabled = false }) {
  const [irisA, setIrisA] = useState({ file: null, preview: null });
  const [irisB, setIrisB] = useState({ file: null, preview: null });

  const handleIrisAChange = useCallback((file, preview) => {
    setIrisA({ file, preview });
    onFilesChange({ irisA: file, irisB: irisB.file });
  }, [irisB.file, onFilesChange]);

  const handleIrisBChange = useCallback((file, preview) => {
    setIrisB({ file, preview });
    onFilesChange({ irisA: irisA.file, irisB: file });
  }, [irisA.file, onFilesChange]);

  const bothUploaded = irisA.file && irisB.file;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">
        <IrisDropzone
          label="Person A's Iris"
          person="A"
          file={irisA.file}
          preview={irisA.preview}
          onFile={handleIrisAChange}
          disabled={disabled}
        />

        {/* Merge indicator */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-10 h-10 rounded-full border-2 transition-all duration-500 flex items-center justify-center ${
            bothUploaded ? 'border-primary-400 bg-primary-900/30 shadow-glow' : 'border-surface-border'
          }`}>
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className={`text-xs font-medium transition-colors ${bothUploaded ? 'text-primary-400' : 'text-slate-600'}`}>
            merge
          </span>
        </div>

        <IrisDropzone
          label="Person B's Iris"
          person="B"
          file={irisB.file}
          preview={irisB.preview}
          onFile={handleIrisBChange}
          disabled={disabled}
        />
      </div>

      {/* Status */}
      <div className="text-center">
        {bothUploaded ? (
          <p className="text-sm text-primary-400 font-medium">Both irises uploaded. Ready to select a template!</p>
        ) : (
          <p className="text-sm text-slate-500">
            {!irisA.file && !irisB.file
              ? 'Upload both iris photos to continue'
              : !irisA.file
              ? 'Upload Person A\'s iris photo'
              : 'Upload Person B\'s iris photo'}
          </p>
        )}
      </div>
    </div>
  );
}
