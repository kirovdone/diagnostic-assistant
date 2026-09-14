// Origin: the in-house design system, src/consts/fieldLimits.ts. Copied unchanged.
export const FIELD_LIMITS = {
  personName: 100,
  email: 320,
  phone: 40,

  postTitle: 120,
  slug: 120,
  pageName: 200,
  taxonomyName: 50,
  categoryName: 32,

  shortDescription: 200,
  description: 300,
  notes: 5000,

  metaTitle: 60,
  metaDescription: 155,

  chatMessage: 1000,
} as const;

export const META_TITLE_RANGE = "50-60";
export const META_DESCRIPTION_RANGE = "120-155";
