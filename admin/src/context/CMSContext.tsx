// ============================================================================
// MG HOME CMS — Central State Management Context (v2.3.0)
// File: admin/src/context/CMSContext.tsx
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { 
  BaseSection, 
  SectionType, 
  DraftSiteSettings, 
  DraftPageMetadata, 
  PageRevision 
} from '../types/cms';
import { 
  INITIAL_SECTIONS, 
  INITIAL_SITE_SETTINGS, 
  INITIAL_PAGE_METADATA 
} from '../lib/initialData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Helper to decode JWT payload safely
function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Database schema adapters (PostgreSQL snake_case <-> TypeScript camelCase)
function toDbSection(sec: BaseSection) {
  return {
    id: sec.id,
    section_type: sec.type,
    section_label: sec.label,
    display_order: sec.order,
    is_visible: sec.isVisible,
    anchor_id: sec.anchorId,
    content: sec.content,
    settings: sec.settings,
    updated_at: new Date().toISOString()
  };
}

function fromDbSection(row: any): BaseSection {
  return {
    id: row.id,
    type: row.section_type,
    label: row.section_label,
    order: row.display_order,
    isVisible: row.is_visible,
    anchorId: row.anchor_id,
    content: row.content || {},
    settings: row.settings || { backgroundVariant: 'default', paddingTop: 'medium', paddingBottom: 'medium' }
  };
}

function toDbSettings(s: DraftSiteSettings) {
  return {
    id: 1,
    business_name_ar: s.businessNameAr,
    business_name_en: s.businessNameEn,
    local_phone: s.localPhone,
    country_code: s.countryCode,
    is_country_code_confirmed: s.isCountryCodeConfirmed,
    instagram_url: s.instagramUrl,
    instagram_handle: s.instagramHandle,
    facebook_url: s.facebookUrl,
    service_messages_ar: s.serviceMessagesAr,
    service_messages_en: s.serviceMessagesEn,
    updated_at: new Date().toISOString()
  };
}

function fromDbSettings(row: any): DraftSiteSettings {
  return {
    businessNameAr: row.business_name_ar ?? INITIAL_SITE_SETTINGS.businessNameAr,
    businessNameEn: row.business_name_en ?? INITIAL_SITE_SETTINGS.businessNameEn,
    localPhone: row.local_phone ?? INITIAL_SITE_SETTINGS.localPhone,
    countryCode: row.country_code ?? INITIAL_SITE_SETTINGS.countryCode,
    isCountryCodeConfirmed: row.is_country_code_confirmed ?? true,
    instagramUrl: row.instagram_url ?? INITIAL_SITE_SETTINGS.instagramUrl,
    instagramHandle: row.instagram_handle ?? INITIAL_SITE_SETTINGS.instagramHandle,
    facebookUrl: row.facebook_url ?? INITIAL_SITE_SETTINGS.facebookUrl,
    serviceMessagesAr: row.service_messages_ar ?? INITIAL_SITE_SETTINGS.serviceMessagesAr,
    serviceMessagesEn: row.service_messages_en ?? INITIAL_SITE_SETTINGS.serviceMessagesEn
  };
}

function toDbMetadata(m: DraftPageMetadata) {
  return {
    id: 1,
    slug: 'home',
    title_ar: m.titleAr,
    title_en: m.titleEn,
    meta_description_ar: m.metaDescriptionAr,
    meta_description_en: m.metaDescriptionEn,
    og_image_url: m.ogImageUrl,
    updated_at: new Date().toISOString()
  };
}

function fromDbMetadata(row: any): DraftPageMetadata {
  return {
    slug: 'home',
    titleAr: row.title_ar ?? INITIAL_PAGE_METADATA.titleAr,
    titleEn: row.title_en ?? INITIAL_PAGE_METADATA.titleEn,
    metaDescriptionAr: row.meta_description_ar ?? INITIAL_PAGE_METADATA.metaDescriptionAr,
    metaDescriptionEn: row.meta_description_en ?? INITIAL_PAGE_METADATA.metaDescriptionEn,
    ogImageUrl: row.og_image_url ?? INITIAL_PAGE_METADATA.ogImageUrl
  };
}

function fromDbRevision(row: any): PageRevision {
  const snap = row.snapshot_data || {};
  return {
    id: row.id,
    revisionNumber: row.revision_number,
    publishedAt: row.published_at,
    publishedBy: row.published_by ? 'Super Admin' : 'System',
    notes: row.notes || '',
    isActive: row.is_active,
    snapshotData: {
      version: snap.version || '2.3.0',
      publishedAt: snap.published_at || row.published_at,
      siteSettings: snap.site_settings ? fromDbSettings(snap.site_settings) : INITIAL_SITE_SETTINGS,
      pageMetadata: snap.page_metadata ? fromDbMetadata(snap.page_metadata) : INITIAL_PAGE_METADATA,
      sections: Array.isArray(snap.sections) ? snap.sections.map(fromDbSection) : []
    }
  };
}

export interface MFAEnrollmentData {
  qrCode: string;
  secret: string;
}

interface CMSContextType {
  // Page Content & State
  sections: BaseSection[];
  selectedSectionId: string | null;
  siteSettings: DraftSiteSettings;
  pageMetadata: DraftPageMetadata;
  activeLanguage: 'ar' | 'en';
  viewportMode: 'desktop' | 'tablet' | 'mobile';
  saveStatus: 'saved' | 'modified' | 'saving';
  
  // Undo / Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Actions
  selectSection: (id: string | null) => void;
  setActiveLanguage: (lang: 'ar' | 'en') => void;
  setViewportMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  updateSiteSettings: (settings: Partial<DraftSiteSettings>) => void;
  updatePageMetadata: (metadata: Partial<DraftPageMetadata>) => void;
  
  // Section Mutations
  addSection: (type: SectionType) => void;
  deleteSection: (id: string) => void;
  duplicateSection: (id: string) => void;
  toggleSectionVisibility: (id: string) => void;
  updateSection: (id: string, updates: Partial<BaseSection>) => void;
  reorderSections: (newSections: BaseSection[]) => void;

  // Publishing & History
  revisions: PageRevision[];
  isPublishing: boolean;
  saveDraft: () => Promise<boolean>;
  publishRevision: (notes?: string) => Promise<{ success: boolean; revisionNumber?: number; error?: string }>;
  restoreRevision: (revisionId: string) => Promise<{ success: boolean; error?: string }>;

  // Admin Auth State
  isAuthenticated: boolean;
  adminEmail: string | null;
  aalLevel: 'aal1' | 'aal2';
  login: (email: string, password: string, totpCode?: string) => Promise<{ 
    success: boolean; 
    requiresMFA?: boolean; 
    requiresMFAEnrollment?: boolean; 
    enrollment?: MFAEnrollmentData;
    error?: string; 
  }>;
  logout: () => Promise<void>;
}

const CMSContext = createContext<CMSContextType | null>(null);

const STORAGE_KEY_SECTIONS = 'mg_cms_draft_sections_v2_3';
const STORAGE_KEY_SETTINGS = 'mg_cms_draft_settings_v2_3';
const STORAGE_KEY_METADATA = 'mg_cms_draft_metadata_v2_3';
const STORAGE_KEY_REVISIONS = 'mg_cms_revisions_v2_3';

export const CMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initial State from localStorage or default seed
  const [sections, setSections] = useState<BaseSection[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SECTIONS);
      return saved ? JSON.parse(saved) : INITIAL_SECTIONS;
    } catch {
      return INITIAL_SECTIONS;
    }
  });

  const [siteSettings, setSiteSettings] = useState<DraftSiteSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : INITIAL_SITE_SETTINGS;
    } catch {
      return INITIAL_SITE_SETTINGS;
    }
  });

  const [pageMetadata, setPageMetadata] = useState<DraftPageMetadata>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_METADATA);
      return saved ? JSON.parse(saved) : INITIAL_PAGE_METADATA;
    } catch {
      return INITIAL_PAGE_METADATA;
    }
  });

  const [revisions, setRevisions] = useState<PageRevision[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REVISIONS);
      return saved ? JSON.parse(saved) : [
        {
          id: 'rev-init-1',
          revisionNumber: 1,
          publishedAt: new Date(Date.now() - 86400000).toISOString(),
          publishedBy: 'Initial Setup',
          notes: 'Default production baseline revision',
          isActive: true,
          snapshotData: {
            version: '2.3.0',
            publishedAt: new Date(Date.now() - 86400000).toISOString(),
            siteSettings: INITIAL_SITE_SETTINGS,
            pageMetadata: INITIAL_PAGE_METADATA,
            sections: INITIAL_SECTIONS
          }
        }
      ];
    } catch {
      return [];
    }
  });

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<'ar' | 'en'>('ar');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Authentication State: strictly derived from verified Supabase session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [aalLevel, setAalLevel] = useState<'aal1' | 'aal2'>('aal1');

  // History Stacks for Undo / Redo
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Helper to snapshot history before a mutation
  const pushHistorySnapshot = useCallback(() => {
    const currentState = JSON.stringify(sections);
    undoStack.current.push(currentState);
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setSaveStatus('modified');
  }, [sections]);

  // Persist draft to local storage on changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(sections));
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(siteSettings));
    localStorage.setItem(STORAGE_KEY_METADATA, JSON.stringify(pageMetadata));
  }, [sections, siteSettings, pageMetadata]);

  // --------------------------------------------------------------------------
  // Supabase Remote Draft Synchronization & Auth Session Lifecycle
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let isCancelled = false;

    // Load active draft and revisions from Supabase
    async function loadRemoteState() {
      try {
        const [settingsRes, metaRes, secRes, revRes] = await Promise.all([
          supabase!.from('draft_site_settings').select('*').eq('id', 1).maybeSingle(),
          supabase!.from('draft_page_metadata').select('*').eq('id', 1).maybeSingle(),
          supabase!.from('draft_page_sections').select('*').order('display_order', { ascending: true }),
          supabase!.from('page_revisions').select('*').order('revision_number', { ascending: false })
        ]);

        if (isCancelled) return;

        if (settingsRes.data) {
          setSiteSettings(fromDbSettings(settingsRes.data));
        }
        if (metaRes.data) {
          setPageMetadata(fromDbMetadata(metaRes.data));
        }
        if (secRes.data && secRes.data.length > 0) {
          setSections(secRes.data.map(fromDbSection));
        }
        if (revRes.data && revRes.data.length > 0) {
          setRevisions(revRes.data.map(fromDbRevision));
        }
      } catch (err) {
        console.warn('[CMS] Failed to fetch remote draft, preserving local state:', err);
      }
    }

    // Verify authenticated session and AAL2 status
    async function verifySession() {
      try {
        const { data: { session }, error } = await supabase!.auth.getSession();
        if (error || !session) {
          setIsAuthenticated(false);
          setAalLevel('aal1');
          setAdminEmail(null);
          return;
        }

        const payload = parseJwtPayload(session.access_token);
        const isAal2 = payload?.aal === 'aal2';

        if (!isAal2) {
          setIsAuthenticated(false);
          setAalLevel('aal1');
          setAdminEmail(session.user.email || null);
          return;
        }

        const { data: profile } = await supabase!
          .from('admin_profiles')
          .select('role, email')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile && profile.role === 'super_admin') {
          setIsAuthenticated(true);
          setAalLevel('aal2');
          setAdminEmail(profile.email || session.user.email || null);
        } else {
          setIsAuthenticated(false);
          setAalLevel('aal1');
          setAdminEmail(null);
        }
      } catch {
        setIsAuthenticated(false);
        setAalLevel('aal1');
        setAdminEmail(null);
      }
    }

    loadRemoteState();
    verifySession();

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setIsAuthenticated(false);
        setAalLevel('aal1');
        setAdminEmail(null);
        return;
      }

      const payload = parseJwtPayload(session.access_token);
      const isAal2 = payload?.aal === 'aal2';

      if (isAal2) {
        const { data: profile } = await supabase!
          .from('admin_profiles')
          .select('role, email')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile && profile.role === 'super_admin') {
          setIsAuthenticated(true);
          setAalLevel('aal2');
          setAdminEmail(profile.email || session.user.email || null);
          return;
        }
      }

      setIsAuthenticated(false);
      setAalLevel(isAal2 ? 'aal2' : 'aal1');
      setAdminEmail(session.user.email || null);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // --------------------------------------------------------------------------
  // History Operations (Undo / Redo)
  // --------------------------------------------------------------------------

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const previous = undoStack.current.pop();
    if (!previous) return;

    redoStack.current.push(JSON.stringify(sections));
    setSections(JSON.parse(previous));
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    setSaveStatus('modified');
  }, [sections]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    if (!next) return;

    undoStack.current.push(JSON.stringify(sections));
    setSections(JSON.parse(next));
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    setSaveStatus('modified');
  }, [sections]);

  // --------------------------------------------------------------------------
  // Section Mutations
  // --------------------------------------------------------------------------

  const selectSection = useCallback((id: string | null) => {
    setSelectedSectionId(id);
  }, []);

  const updateSiteSettings = useCallback((settings: Partial<DraftSiteSettings>) => {
    setSiteSettings(prev => ({ ...prev, ...settings }));
    setSaveStatus('modified');
  }, []);

  const updatePageMetadata = useCallback((metadata: Partial<DraftPageMetadata>) => {
    setPageMetadata(prev => ({ ...prev, ...metadata }));
    setSaveStatus('modified');
  }, []);

  const addSection = useCallback((type: SectionType) => {
    pushHistorySnapshot();
    // Generate valid UUIDv4 for all sections
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `a1000000-0000-4000-8000-${Date.now().toString().padStart(12, '0')}`;
    const highestOrder = sections.reduce((max, s) => Math.max(max, s.order), 0);

    let defaultContent: any = {};
    let defaultLabel = "قسم جديد";

    switch (type) {
      case 'cta-banner':
        defaultLabel = "بانر الحث على اتخاذ إجراء (CTA)";
        defaultContent = {
          badgeAr: "عرض حصري",
          badgeEn: "Exclusive Offer",
          titleAr: "جاهز لتأسيس أو صيانة تكييفك بأعلى معايير الجودة؟",
          titleEn: "Ready for Top-Tier AC Installation & Repair?",
          subtitleAr: "تواصل مع فريقنا الفني المتخصص الآن عبر واتساب واحصل على معاينة سريعة وتسعير دقيق.",
          subtitleEn: "Get in touch with our certified technicians today for prompt inspection and transparent pricing.",
          buttonTextAr: "تواصل عبر واتساب فورًا",
          buttonTextEn: "Chat via WhatsApp Now",
          buttonAction: "whatsapp"
        };
        break;

      case 'faq':
        defaultLabel = "الأسئلة الشائعة (FAQ)";
        defaultContent = {
          badgeAr: "إجابات واضحة",
          badgeEn: "Helpful Answers",
          titleAr: "الأسئلة الشائعة",
          titleEn: "Frequently Asked Questions",
          descriptionAr: "إجابات وافية عن استفساراتكم المتعلقة بضمان الصيانة، أنواع النحاس، وشحن الفريون.",
          descriptionEn: "Everything you need to know about our warranties, copper piping specs, and freon recharging.",
          items: [
            {
              id: "faq-1",
              questionAr: "ما هو أفضل نوع مواسير نحاس لتأسيس تكييف المنازل؟",
              questionEn: "What is the best copper pipe type for home AC rough-in?",
              answerAr: "نوصي بالنحاس الأمريكي المعتمد للأحمال العالية والمسارات المدفونة داخل الجدران نظراً لسماكته الفائقة، والنحاس الكوري كخيار ممتاز يجمع بين المرونة والمتانة.",
              answerEn: "We strongly recommend genuine American copper for buried chases due to its wall thickness, and Korean copper for its balanced flexibility and durability."
            },
            {
              id: "faq-2",
              questionAr: "هل تقدمون ضمانًا على أعمال الصيانة وقطع الغيار؟",
              questionEn: "Do you offer a warranty on maintenance and spare parts?",
              answerAr: "نعم، نقدم ضمانًا فنيًا معتمدًا على كافة أعمال التركيب والصيانة وقطع الغيار الأصلية المستخدمة.",
              answerEn: "Yes, all our installation, repair jobs, and genuine replacement parts come with a certified service warranty."
            }
          ]
        };
        break;

      case 'testimonials':
        defaultLabel = "آراء العملاء (Testimonials)";
        defaultContent = {
          badgeAr: "ثقة العملاء",
          badgeEn: "Client Testimonials",
          titleAr: "ماذا يقول عملاؤنا عن خدماتنا",
          titleEn: "What Our Valued Clients Say",
          descriptionAr: "تقييمات وتجارب حقيقية لعملاء وثقوا بخدمات MG HOME في التكييف والصيانة.",
          descriptionEn: "Real testimonials and ratings from clients who trusted MG HOME for HVAC and home maintenance.",
          items: [
            {
              id: "t-1",
              clientNameAr: "أبو فهد العتيبي",
              clientNameEn: "Abu Fahad Al-Otaibi",
              locationAr: "الرياض — حي النرجس",
              locationEn: "Riyadh — Al-Narjis",
              rating: 5,
              commentAr: "تمديد نحاس أمريكي ممتاز لفيلا تحت الإنشاء، دقة بالمواعيد واختبار ضغط النيتروجين تم باحترافية.",
              commentEn: "Excellent American copper piping for my new villa. On-time delivery and professional nitrogen pressure testing.",
              serviceTagAr: "تمديد نحاس",
              serviceTagEn: "Copper Piping"
            },
            {
              id: "t-2",
              clientNameAr: "م. خالد السعدي",
              clientNameEn: "Eng. Khaled Al-Saadi",
              locationAr: "جدة — حي الروضة",
              locationEn: "Jeddah — Al-Rawdah",
              rating: 5,
              commentAr: "تم إصلاح عطل غسالة ميتاج وتعبئة فريون مكيف دولابي في نفس الزيارة. فنيون محترفون وأسعار واضحة.",
              commentEn: "Repaired Maytag washer and recharged standing AC freon in a single visit. Professional crew and transparent rates.",
              serviceTagAr: "صيانة أجهزة",
              serviceTagEn: "Appliance Repair"
            }
          ]
        };
        break;

      case 'text-image':
        defaultLabel = "محتوى مع صورة (Text & Image)";
        defaultContent = {
          badgeAr: "عن MG HOME",
          badgeEn: "About MG HOME",
          titleAr: "ريادة معتمدة في هندسة التكييف والتبريد",
          titleEn: "Certified Excellence in HVAC & Refrigeration",
          bodyAr: "نلتزم بأعلى المقاييس الفنية في تأسيس وصيانة أنظمة التكييف المركزي والمخفي والسبليت، ونوفر حلول صيانة الأجهزة المنزلية المتكاملة مع الفحص الميداني الدقيق واختبارات الجودة الصارمة.",
          bodyEn: "We adhere to the highest engineering standards in rough-in and maintenance of central, concealed, and split AC systems, providing reliable appliance repairs with rigorous quality assurance.",
          imageUrl: "assets/logo/mg-home-logo.jpeg",
          imageAltAr: "شعار إم جي هوم لأعمال التكييف والصيانة",
          imageAltEn: "MG HOME AC & Maintenance Logo",
          imagePosition: "right"
        };
        break;

      default:
        defaultLabel = `قسم ${type}`;
        defaultContent = {};
        break;
    }

    const uniqueAnchor = `${type}-${Date.now().toString(36)}`;
    const newSection: BaseSection = {
      id: newId,
      type,
      label: defaultLabel,
      order: highestOrder + 10,
      isVisible: true,
      anchorId: uniqueAnchor,
      settings: {
        backgroundVariant: 'default',
        paddingTop: 'medium',
        paddingBottom: 'medium'
      },
      content: defaultContent
    };

    setSections(prev => [...prev, newSection]);
    setSelectedSectionId(newId);
    setSaveStatus('modified');
  }, [sections, pushHistorySnapshot]);

  const deleteSection = useCallback((id: string) => {
    pushHistorySnapshot();
    setSections(prev => prev.filter(s => s.id !== id));
    if (selectedSectionId === id) setSelectedSectionId(null);
    setSaveStatus('modified');
  }, [selectedSectionId, pushHistorySnapshot]);

  const duplicateSection = useCallback((id: string) => {
    const target = sections.find(s => s.id === id);
    if (!target) return;

    pushHistorySnapshot();
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `a1000000-0000-4000-8000-${Date.now().toString().padStart(12, '0')}`;
    const clone: BaseSection = {
      ...JSON.parse(JSON.stringify(target)),
      id: newId,
      label: `${target.label} (نسخة)`,
      anchorId: `${target.anchorId}-copy-${Date.now().toString(36)}`,
      order: target.order + 5
    };

    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next.map((s, i) => ({ ...s, order: (i + 1) * 10 }));
    });
    setSelectedSectionId(newId);
    setSaveStatus('modified');
  }, [sections, pushHistorySnapshot]);

  const toggleSectionVisibility = useCallback((id: string) => {
    pushHistorySnapshot();
    setSections(prev => prev.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s));
    setSaveStatus('modified');
  }, [pushHistorySnapshot]);

  const updateSection = useCallback((id: string, updates: Partial<BaseSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setSaveStatus('modified');
  }, []);

  const reorderSections = useCallback((newSections: BaseSection[]) => {
    pushHistorySnapshot();
    // Renumber display_order cleanly by tens: 10, 20, 30...
    const monotonic = newSections.map((sec, idx) => ({
      ...sec,
      order: (idx + 1) * 10
    }));
    setSections(monotonic);
    setSaveStatus('modified');

    // If Supabase is connected and user is authenticated, sync order immediately via RPC
    if (isSupabaseConfigured && supabase && isAuthenticated) {
      const orderedIds = monotonic.map(s => s.id);
      void (async () => {
        try {
          const { error } = await supabase.rpc('reorder_draft_sections', { p_ordered_ids: orderedIds });
          if (error) {
            console.error('[CMS] Reorder RPC error:', error.message);
          }
        } catch (err: any) {
          console.error('[CMS] Reorder network error:', err);
        }
      })();
    }
  }, [pushHistorySnapshot, isAuthenticated]);

  // --------------------------------------------------------------------------
  // Draft & Publishing Operations
  // --------------------------------------------------------------------------

  const saveDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(sections));
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(siteSettings));
      localStorage.setItem(STORAGE_KEY_METADATA, JSON.stringify(pageMetadata));

      if (isSupabaseConfigured && supabase) {
        const payloadSettings = toDbSettings(siteSettings);
        const payloadMetadata = toDbMetadata(pageMetadata);
        const payloadSections = sections.map((sec, idx) => toDbSection({ ...sec, order: (idx + 1) * 10 }));

        const { data, error: txError } = await supabase.rpc('save_draft_page_transaction', {
          p_site_settings: payloadSettings,
          p_page_metadata: payloadMetadata,
          p_sections: payloadSections
        });

        if (txError) {
          throw new Error(`Transactional draft persistence failed: ${txError.message}`);
        }

        if (!data || !data.success) {
          throw new Error('Transactional draft persistence failed to confirm database write.');
        }
      }

      setSaveStatus('saved');
      return true;
    } catch (err: any) {
      console.error('[CMS] Save draft error:', err);
      setSaveStatus('modified');
      return false;
    }
  }, [sections, siteSettings, pageMetadata]);

  const publishRevision = useCallback(async (notes?: string) => {
    setIsPublishing(true);
    try {
      // Must successfully persist all draft changes before publishing snapshot
      const draftPersisted = await saveDraft();
      if (!draftPersisted) {
        setIsPublishing(false);
        return { 
          success: false, 
          error: 'Cannot publish: Draft persistence to Supabase failed. Please check network and permissions.' 
        };
      }

      const newRevNumber = revisions.length + 1;
      const snapshot = {
        version: '2.3.0',
        publishedAt: new Date().toISOString(),
        siteSettings,
        pageMetadata,
        sections
      };

      const newRevision: PageRevision = {
        id: `rev-${Date.now().toString(36)}`,
        revisionNumber: newRevNumber,
        publishedAt: new Date().toISOString(),
        publishedBy: adminEmail || 'Administrator',
        notes: notes || 'Published via Visual Page Builder',
        isActive: true,
        snapshotData: snapshot
      };

      // Set other revisions to inactive locally
      const updatedRevisions = [
        newRevision,
        ...revisions.map(r => ({ ...r, isActive: false }))
      ];

      setRevisions(updatedRevisions);
      localStorage.setItem(STORAGE_KEY_REVISIONS, JSON.stringify(updatedRevisions));

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('publish_page_revision', {
          p_notes: notes || 'Published via Visual Page Builder'
        });
        if (error) throw error;
        setIsPublishing(false);
        return { success: true, revisionNumber: data.revision_number };
      }

      setIsPublishing(false);
      return { success: true, revisionNumber: newRevNumber };
    } catch (err: any) {
      setIsPublishing(false);
      console.error('[CMS] Publish error:', err);
      return { success: false, error: err.message || 'Publishing transaction failed' };
    }
  }, [saveDraft, revisions, siteSettings, pageMetadata, sections, adminEmail]);

  const restoreRevision = useCallback(async (revisionId: string) => {
    try {
      const target = revisions.find(r => r.id === revisionId);
      if (!target || !target.snapshotData) {
        return { success: false, error: 'Revision snapshot not found' };
      }

      pushHistorySnapshot();
      const snap = target.snapshotData;
      if (snap.sections) setSections(snap.sections);
      if (snap.siteSettings) setSiteSettings(snap.siteSettings);
      if (snap.pageMetadata) setPageMetadata(snap.pageMetadata);

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.rpc('restore_revision_to_draft', {
          p_revision_id: revisionId
        });
        if (error) throw error;
      }

      setSaveStatus('modified');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Restoration failed' };
    }
  }, [revisions, pushHistorySnapshot]);

  // --------------------------------------------------------------------------
  // Admin Authentication Operations (Supabase MFA / AAL2 Enforced)
  // --------------------------------------------------------------------------

  const login = useCallback(async (email: string, pass: string, totpCode?: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { 
        success: false, 
        error: 'Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' 
      };
    }

    try {
      // 1. Password Authentication
      let session = (await supabase.auth.getSession()).data.session;
      if (!session || (email && pass)) {
        const { data: signData, error: signError } = await supabase.auth.signInWithPassword({ 
          email, 
          password: pass 
        });
        if (signError) {
          return { success: false, error: signError.message };
        }
        session = signData.session;
      }

      // 2. Query MFA Factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        return { success: false, error: `MFA Factor check error: ${factorsError.message}` };
      }

      const verifiedFactor = factorsData?.totp?.find(f => f.status === 'verified');

      // 3. Challenge verified factor if present
      if (verifiedFactor) {
        if (!totpCode) {
          return { success: false, requiresMFA: true };
        }

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: verifiedFactor.id,
          code: totpCode
        });

        if (verifyError) {
          return { success: false, requiresMFA: true, error: `Invalid TOTP code: ${verifyError.message}` };
        }
      } else {
        // 4. No verified TOTP factor: initiate enrollment flow
        const unverified = factorsData?.totp?.find((f: any) => f.status === 'unverified');
        let factorIdToVerify: string;
        let qrCode = '';
        let secret = '';

        if (unverified && !totpCode) {
          factorIdToVerify = unverified.id;
        } else {
          const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'MG HOME CMS'
          });

          if (enrollError) {
            return { success: false, error: `MFA Enrollment Failed: ${enrollError.message}` };
          }

          factorIdToVerify = enrollData.id;
          qrCode = enrollData.totp.qr_code;
          secret = enrollData.totp.secret;
        }

        if (!totpCode) {
          return {
            success: false,
            requiresMFAEnrollment: true,
            enrollment: { qrCode, secret }
          };
        }

        // Verify the newly enrolled factor
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factorIdToVerify,
          code: totpCode
        });

        if (verifyError) {
          return {
            success: false,
            requiresMFAEnrollment: true,
            enrollment: { qrCode, secret },
            error: `Invalid TOTP verification code: ${verifyError.message}`
          };
        }
      }

      // 5. Verify user profile has super_admin role
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        return { success: false, error: 'User session not found.' };
      }

      const { data: profile, error: profError } = await supabase
        .from('admin_profiles')
        .select('role, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profError || !profile || profile.role !== 'super_admin') {
        await supabase.auth.signOut();
        return { 
          success: false, 
          error: 'Access Denied: Your account does not have super_admin privileges in admin_profiles.' 
        };
      }

      setIsAuthenticated(true);
      setAalLevel('aal2');
      setAdminEmail(profile.email || user.email || null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication error occurred.' };
    }
  }, []);

  const logout = useCallback(async () => {
    setIsAuthenticated(false);
    setAalLevel('aal1');
    setAdminEmail(null);
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
  }, []);

  return (
    <CMSContext.Provider
      value={{
        sections,
        selectedSectionId,
        siteSettings,
        pageMetadata,
        activeLanguage,
        viewportMode,
        saveStatus,
        canUndo,
        canRedo,
        undo,
        redo,
        selectSection,
        setActiveLanguage,
        setViewportMode,
        updateSiteSettings,
        updatePageMetadata,
        addSection,
        deleteSection,
        duplicateSection,
        toggleSectionVisibility,
        updateSection,
        reorderSections,
        revisions,
        isPublishing,
        saveDraft,
        publishRevision,
        restoreRevision,
        isAuthenticated,
        adminEmail,
        aalLevel,
        login,
        logout
      }}
    >
      {children}
    </CMSContext.Provider>
  );
};

export const useCMS = () => {
  const context = useContext(CMSContext);
  if (!context) {
    throw new Error('useCMS must be used within a CMSProvider');
  }
  return context;
};
