import React from 'react';
import MockupGallery from './MockupGallery.jsx';

/**
 * ProductMockups — thin wrapper around MockupGallery.
 * Used by NewMerge and other admin-facing views.
 */
export default function ProductMockups({ imageUrl }) {
  return <MockupGallery imageUrl={imageUrl} />;
}
