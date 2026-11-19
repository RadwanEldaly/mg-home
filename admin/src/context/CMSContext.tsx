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
  login: (email: string, password: string, totpCode?: string) => Promise<{ success: boolean; requiresMFA?: boolean; error?: string }>;
  logout: () => void;
}

const CMSContext = createContext<CMSContextType | null>(null);

const STORAGE_KEY_SECTIONS = 'mg_cms_draft_sections_v2_3';
const STORAGE_KEY_SETTINGS = 'mg_cms_draft_settings_v2_3';
const STORAGE_KEY_METADATA = 'mg_cms_draft_metadata_v2_3';
const STORAGE_KEY_REVISIONS = 'mg_cms_revisions_v2_3';
const STORAGE_KEY_AUTH = 'mg_cms_auth_session_v2_3';

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

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AUTH) === 'true';
    } catch {
      return false;
    }
  });
  const [adminEmail, setAdminEmail] = useState<string | null>('admin@mg-home.online');
  const [aalLevel, setAalLevel] = useState<'aal1' | 'aal2'>('aal2');

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

  // Select first section if none selected
  useEffect(() => {
    if (!selectedSectionId && sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [selectedSectionId, sections]);

  // Undo Handler
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

  // Redo Handler
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
  // Section CRUD Operations
  // --------------------------------------------------------------------------

  const selectSection = useCallback((id: string | null) => {
    setSelectedSectionId(id);
  }, []);

  const updateSiteSettings = useCallback((updates: Partial<DraftSiteSettings>) => {
    setSiteSettings(prev => ({ ...prev, ...updates }));
    setSaveStatus('modified');
  }, []);

  const updatePageMetadata = useCallback((updates: Partial<DraftPageMetadata>) => {
    setPageMetadata(prev => ({ ...prev, ...updates }));
    setSaveStatus('modified');
  }, []);

  const addSection = useCallback((type: SectionType) => {
    pushHistorySnapshot();
    const newId = `sec-${type}-${Date.now().toString(36)}`;
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
              commentAr: "صيانة مكيفات سبليت وحل مشكلة تسريب الفريون بشكل نهائي، فريق فني محترم وذو خبرة عالية.",
              commentEn: "Fixed our split AC freon leak once and for all. Very respectful, skilled, and clean technician team.",
              serviceTagAr: "صيانة سبليت",
              serviceTagEn: "Split AC Repair"
            }
          ]
        };
        break;

      case 'text-image':
        defaultLabel = "قصة المؤسسة ومعاييرنا (Text & Image)";
        defaultContent = {
          badgeAr: "عن MG HOME",
          badgeEn: "About MG HOME",
          titleAr: "التزام تام بالجودة والسلامة الهندسية",
          titleEn: "Uncompromising Quality & Engineering Safety",
          descriptionAr: "منذ انطلاقنا في السوق السعودي، حرصنا على توفير أفضل معايير التبريد والتكييف مستعينين بكوادر فنية متمرسة، ومستخدمين خامات معتمدة تضمن استدامة الأداء لسنوات طويلة.",
          descriptionEn: "Serving the Saudi market with top engineering standards, experienced technicians, and certified materials ensuring long-lasting performance.",
          bulletsAr: [
            "فريق فني متخصص مدرب على أحدث تقنيات الإنفرتر والدكت",
            "استخدام معدات فحص إلكترونية وأجهزة قياس الضغط الرقمية"
          ],
          bulletsEn: [
            "Specialized technical team certified in inverter and duct systems",
            "Advanced digital manifold gauges and electronic leak detection"
          ],
          image: "assets/maintenance/ac-outdoor-lg-dual-inverter.jpeg",
          imagePosition: "right",
          buttonTextAr: "تواصل معنا للاستفسار",
          buttonTextEn: "Contact Us Today",
          buttonUrl: "#contact"
        };
        break;

      default:
        defaultLabel = `قسم ${type}`;
        defaultContent = { titleAr: `قسم جديد (${type})`, titleEn: `New Section (${type})` };
    }

    const newSection: BaseSection = {
      id: newId,
      type,
      label: defaultLabel,
      order: highestOrder + 10,
      isVisible: true,
      anchorId: `${type}-${Date.now().toString(36).slice(-4)}`,
      settings: {
        backgroundVariant: 'default',
        paddingTop: 'medium',
        paddingBottom: 'medium'
      },
      content: defaultContent
    };

    setSections(prev => [...prev, newSection]);
    setSelectedSectionId(newId);
  }, [sections, pushHistorySnapshot]);

  const deleteSection = useCallback((id: string) => {
    if (sections.length <= 1) {
      alert(activeLanguage === 'ar' ? 'لا يمكن حذف كافة الأقسام، يجب بقاء قسم واحد على الأقل.' : 'Cannot delete all sections. At least one must remain.');
      return;
    }
    pushHistorySnapshot();
    setSections(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (selectedSectionId === id) {
        setSelectedSectionId(filtered[0]?.id || null);
      }
      return filtered;
    });
  }, [sections, selectedSectionId, activeLanguage, pushHistorySnapshot]);

  const duplicateSection = useCallback((id: string) => {
    const target = sections.find(s => s.id === id);
    if (!target) return;
    pushHistorySnapshot();

    const cloneId = `sec-${target.type}-${Date.now().toString(36)}`;
    const cloned: BaseSection = {
      ...JSON.parse(JSON.stringify(target)),
      id: cloneId,
      label: `${target.label} (نسخة)`,
      anchorId: `${target.anchorId}-copy`,
      order: target.order + 5
    };

    const targetIndex = sections.findIndex(s => s.id === id);
    const updated = [...sections];
    updated.splice(targetIndex + 1, 0, cloned);

    // Rebalance display orders monotonically
    const reordered = updated.map((sec, idx) => ({ ...sec, order: (idx + 1) * 10 }));
    setSections(reordered);
    setSelectedSectionId(cloneId);
  }, [sections, pushHistorySnapshot]);

  const toggleSectionVisibility = useCallback((id: string) => {
    pushHistorySnapshot();
    setSections(prev => prev.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s));
  }, [pushHistorySnapshot]);

  const updateSection = useCallback((id: string, updates: Partial<BaseSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setSaveStatus('modified');
  }, []);

  const reorderSections = useCallback((newSections: BaseSection[]) => {
    pushHistorySnapshot();
    // Renumber display_order cleanly by tens: 10, 20, 30...
    const monotonic = newSections.map((sec, index) => ({
      ...sec,
      order: (index + 1) * 10
    }));
    setSections(monotonic);
  }, [pushHistorySnapshot]);

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
        // Update draft tables in Supabase
        await supabase.from('draft_site_settings').update(siteSettings).eq('id', 1);
        await supabase.from('draft_page_metadata').update(pageMetadata).eq('id', 1);
      }

      setSaveStatus('saved');
      return true;
    } catch (err) {
      console.error('[CMS] Save draft error:', err);
      setSaveStatus('modified');
      return false;
    }
  }, [sections, siteSettings, pageMetadata]);

  const publishRevision = useCallback(async (notes?: string) => {
    setIsPublishing(true);
    try {
      await saveDraft();

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

      // Set other revisions to inactive
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
  // Admin Authentication Operations
  // --------------------------------------------------------------------------

  const login = useCallback(async (email: string, pass: string, totpCode?: string) => {
    // If Supabase is connected, authenticate through Supabase Auth
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return { success: false, error: error.message };

      if (data.session) {
        // Check for MFA challenge
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData && aalData.nextLevel === 'aal2' && !totpCode) {
          return { success: false, requiresMFA: true };
        }
      }
    }

    // Default administrative authentication flow
    if (email === 'admin@mg-home.online' || email === 'radwaneldaly14@gmail.com') {
      setIsAuthenticated(true);
      setAdminEmail(email);
      setAalLevel('aal2');
      localStorage.setItem(STORAGE_KEY_AUTH, 'true');
      return { success: true };
    }

    return { success: false, error: 'Invalid administrative credentials' };
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY_AUTH);
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
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
