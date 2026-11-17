import React, { useState } from 'react';
import { Leaf } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = 'w-14 h-14 rounded-xl',
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 dark:from-[#192A20] dark:to-[#111C16] border border-emerald-950/10 dark:border-emerald-100/10 shrink-0`}
        aria-label={alt}
      >
        <Leaf className="w-5 h-5 text-[#15803D] dark:text-[#4ADE80]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 shrink-0`}
    />
  );
};
