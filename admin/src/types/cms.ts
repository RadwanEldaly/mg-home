// ============================================================================
// MG HOME CMS — Core TypeScript Data Contracts (v2.3.0)
// File: admin/src/types/cms.ts
// ============================================================================

export type SectionType = 
  | 'hero' 
  | 'services' 
  | 'copper' 
  | 'gallery' 
  | 'contact' 
  | 'cta-banner' 
  | 'faq' 
  | 'testimonials' 
  | 'text-image';

export interface SectionSettings {
  backgroundVariant: 'default' | 'surface-alt' | 'glass-gradient' | 'dark-brand';
  paddingTop: 'none' | 'small' | 'medium' | 'large';
  paddingBottom: 'none' | 'small' | 'medium' | 'large';
  customClass?: string;
}

export interface BaseSection<T = any> {
  id: string; // UUIDv4
  type: SectionType;
  label: string;
  order: number;
  isVisible: boolean;
  anchorId: string;
  content: T;
  settings: SectionSettings;
}

// ----------------------------------------------------------------------------
// Section-Specific Content Schemas
// ----------------------------------------------------------------------------

export interface HeroContent {
  badgeAr: string;
  badgeEn: string;
  titleHighlightAr: string;
  titleHighlightEn: string;
  titleSuffixAr: string;
  titleSuffixEn: string;
  descriptionAr: string;
  descriptionEn: string;
  primaryCtaTextAr: string;
  primaryCtaTextEn: string;
  primaryCtaWaMessageKey: string;
  secondaryCtaTextAr: string;
  secondaryCtaTextEn: string;
  secondaryCtaTarget: string;
  features: Array<{
    id: string;
    icon: string;
    textAr: string;
    textEn: string;
  }>;
  floatingCard: {
    logoImage: string;
    badgeTitleAr: string;
    badgeTitleEn: string;
    badgeSubtitleAr: string;
    badgeSubtitleEn: string;
  };
}

export interface ServiceItem {
  id: string;
  serviceKey: string;
  iconName: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  bulletsAr: string[];
  bulletsEn: string[];
  buttonTextAr: string;
  buttonTextEn: string;
}

export interface ServicesContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  items: ServiceItem[];
}

export interface CopperContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  types: Array<{
    id: string;
    tagAr: string;
    tagEn: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    bulletsAr: string[];
    bulletsEn: string[];
    image: string;
    waServiceKey: string;
  }>;
  fieldworkHeader: {
    badgeAr: string;
    badgeEn: string;
    titleAr: string;
    titleEn: string;
    subtitleAr: string;
    subtitleEn: string;
  };
  fieldworkCards: Array<{
    id: string;
    titleAr: string;
    titleEn: string;
    image: string;
  }>;
}

export interface GalleryItem {
  id: string;
  category: 'split' | 'duct' | 'copper' | 'washing' | 'fridge';
  categoryAr: string;
  categoryEn: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  image: string;
  width?: number;
  height?: number;
}

export interface GalleryContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  items: GalleryItem[];
}

export interface ContactContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  formTitleAr: string;
  formTitleEn: string;
  formSubtitleAr: string;
  formSubtitleEn: string;
  workingHoursAr: string;
  workingHoursEn: string;
  locationAr: string;
  locationEn: string;
}

export interface CtaBannerContent {
  badgeAr?: string;
  badgeEn?: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  buttonTextAr: string;
  buttonTextEn: string;
  buttonAction: 'whatsapp' | 'tel' | 'anchor';
  buttonTarget?: string;
}

export interface FaqItem {
  id: string;
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
}

export interface FaqContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  items: FaqItem[];
}

export interface TestimonialItem {
  id: string;
  clientNameAr: string;
  clientNameEn: string;
  locationAr: string;
  locationEn: string;
  rating: number; // 1 to 5
  commentAr: string;
  commentEn: string;
  serviceTagAr?: string;
  serviceTagEn?: string;
}

export interface TestimonialsContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  items: TestimonialItem[];
}

export interface TextImageContent {
  badgeAr?: string;
  badgeEn?: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  bulletsAr?: string[];
  bulletsEn?: string[];
  image: string;
  imagePosition: 'left' | 'right';
  buttonTextAr?: string;
  buttonTextEn?: string;
  buttonUrl?: string;
}

// ----------------------------------------------------------------------------
// Site Configuration & Page Metadata
// ----------------------------------------------------------------------------

export interface DraftSiteSettings {
  businessNameAr: string;
  businessNameEn: string;
  localPhone: string;
  countryCode: string;
  isCountryCodeConfirmed: boolean;
  instagramUrl: string;
  instagramHandle: string;
  facebookUrl: string;
  serviceMessagesAr: Record<string, string>;
  serviceMessagesEn: Record<string, string>;
}

export interface DraftPageMetadata {
  slug: 'home';
  titleAr: string;
  titleEn: string;
  metaDescriptionAr: string;
  metaDescriptionEn: string;
  ogImageUrl: string;
}

export interface PageRevision {
  id: string;
  revisionNumber: number;
  publishedAt: string;
  publishedBy: string;
  notes: string;
  isActive: boolean;
  snapshotData: {
    version: string;
    publishedAt: string;
    siteSettings: DraftSiteSettings;
    pageMetadata: DraftPageMetadata;
    sections: BaseSection[];
  };
}

// ----------------------------------------------------------------------------
// Preview Protocol Contract
// ----------------------------------------------------------------------------

export const CMS_PREVIEW_PROTOCOL = {
  VERSION: '2.3.0',
  MAX_PAYLOAD_BYTES: 1048576,
  HANDSHAKE_TIMEOUT_MS: 5000,
  TRUSTED_PUBLIC_ORIGIN: window.location.origin.includes('localhost') 
    ? window.location.origin 
    : 'https://www.mg-home.online',
  TRUSTED_ADMIN_ORIGIN: window.location.origin
} as const;

export type PreviewMessageType =
  | 'MG_PREVIEW_HANDSHAKE_READY'
  | 'MG_PREVIEW_INIT'
  | 'MG_PREVIEW_INIT_ACK'
  | 'MG_PREVIEW_UPDATE_SECTION'
  | 'MG_PREVIEW_SECTION_SELECTED'
  | 'MG_PREVIEW_ERROR';

export interface PreviewMessageEnvelope<T = any> {
  protocol: 'MG_HOME_CMS_PREVIEW';
  version: '2.3.0';
  id: string;
  timestamp: number;
  type: PreviewMessageType;
  payload?: T;
}
