"use client";

// Origin: the in-house design system, the `LocaleFlag` export of src/components/fields/LanguageMenu.tsx.
//
// Only change: @/components/ -> @/components/kit/. The rest of the design system's
// LanguageMenu is its business-language editor, which reaches StoredLanguage and the
// settings draft; LocaleFlag is the part the account menu uses and the part copied here.
// The SVGs it points at are the library's own, copied into public/locales/.
import { Image } from "@/components/kit/ui/Image";

export const LocaleFlag = ({ locale }: { locale: string }) => (
  <Image
    file={{ src: `/locales/${locale}/${locale}.svg`, alt: `${locale}-flag` }}
    width={16}
    height={12}
    objectFit="cover"
    className="rounded-sm shrink-0"
    unoptimized
  />
);
