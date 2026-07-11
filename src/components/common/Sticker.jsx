import React, { useEffect, useState } from 'react';

export function Sticker({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return null;

  return (
    <img
      alt={alt}
      className={`sticker ${className}`}
      draggable="false"
      onError={() => setFailed(true)}
      src={src}
    />
  );
}
