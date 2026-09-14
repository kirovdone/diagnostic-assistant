// Shim for the design system's src/components/ui/Image.tsx.
//
// the design system's version is 244 lines of CDN path resolution, blur placeholders, srcset
// handling and a NotFound fallback, all of it for images served from its own asset
// pipeline. There is no asset pipeline here and no user has a picture, so the only
// caller, Avatar, always takes its initials branch and never renders this.
//
// It is a shim rather than a copy for the same reason @/types/entities is: the copied
// component sits at the same specifier and is byte-identical apart from its import
// paths. It is a working <img> rather than null, so that a user with a picture would
// render one instead of finding out this was a stub.
import type { ImgHTMLAttributes } from "react";

export function Image({
  file,
  fill,
  className,
  objectFit,
  unoptimized: _unoptimized,
  ...rest
}: {
  file: { src: string; alt?: string };
  fill?: boolean;
  className?: string;
  objectFit?: "cover" | "contain";
  // Accepted and ignored, the way next/image ignores it for an unoptimised source. It is
  // in the signature because the copied callers pass it.
  unoptimized?: boolean;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={file.src}
      alt={file.alt ?? ""}
      className={className}
      style={{
        ...(fill ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" } : {}),
        ...(objectFit ? { objectFit } : {}),
      }}
      {...rest}
    />
  );
}
