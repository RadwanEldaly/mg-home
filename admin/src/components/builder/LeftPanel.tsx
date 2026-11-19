// ============================================================================
// MG HOME CMS — Left Panel: Outline Tree & Section Library (v2.3.0)
// File: admin/src/components/builder/LeftPanel.tsx
// ============================================================================

import React, { useState } from 'react';
import { useCMS } from '../../context/CMSContext';
import type { BaseSection, SectionType } from '../../types/cms';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  type DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  useSortable, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Layers, 
  Plus, 
  GripVertical, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Sparkles, 
  Wrench, 
  Cpu, 
  Images, 
  MessageSquare, 
  HelpCircle, 
  Star, 
  FileText, 
  Megaphone 
} from 'lucide-react';

interface SortableItemProps {
  section: BaseSection;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isAr: boolean;
}

const getSectionIcon = (type: SectionType) => {
  switch (type) {
    case 'hero': return <Sparkles className="w-4 h-4 text-amber-400" />;
    case 'services': return <Wrench className="w-4 h-4 text-sky-400" />;
    case 'copper': return <Cpu className="w-4 h-4 text-orange-400" />;
    case 'gallery': return <Images className="w-4 h-4 text-emerald-400" />;
    case 'contact': return <MessageSquare className="w-4 h-4 text-blue-400" />;
    case 'cta-banner': return <Megaphone className="w-4 h-4 text-rose-400" />;
    case 'faq': return <HelpCircle className="w-4 h-4 text-purple-400" />;
    case 'testimonials': return <Star className="w-4 h-4 text-yellow-400" />;
    case 'text-image': return <FileText className="w-4 h-4 text-teal-400" />;
  }
};

const SortableSectionItem: React.FC<SortableItemProps> = ({
  section,
  isSelected,
  onSelect,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  isAr
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all mb-2 cursor-pointer ${
        isSelected
          ? 'bg-slate-800/90 border-sky-500 shadow-sm shadow-sky-500/10'
          : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
      } ${!section.isVisible ? 'opacity-50' : ''}`}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing rounded hover:bg-slate-800"
        title={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Icon & Label */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0 mx-2">
        <div className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800">
          {getSectionIcon(section.type)}
        </div>
        <div className="truncate">
          <p className="text-xs font-semibold text-slate-200 truncate">{section.label}</p>
          <span className="text-[10px] text-slate-400 font-mono">#{section.anchorId}</span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
        {/* Toggle Visibility */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          title={section.isVisible ? (isAr ? 'إخفاء القسم' : 'Hide Section') : (isAr ? 'إظهار القسم' : 'Show Section')}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          {section.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
        </button>

        {/* Duplicate */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title={isAr ? 'تكرار القسم' : 'Duplicate Section'}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={isAr ? 'حذف القسم' : 'Delete Section'}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const LeftPanel: React.FC = () => {
  const {
    sections,
    selectedSectionId,
    selectSection,
    toggleSectionVisibility,
    duplicateSection,
    deleteSection,
    reorderSections,
    addSection,
    activeLanguage
  } = useCMS();

  const [activeTab, setActiveTab] = useState<'tree' | 'library'>('tree');
  const isAr = activeLanguage === 'ar';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const moved = arrayMove(sections, oldIndex, newIndex);
      reorderSections(moved);
    }
  };

  const AVAILABLE_SECTION_TYPES: Array<{ type: SectionType; titleAr: string; titleEn: string; descAr: string; descEn: string }> = [
    {
      type: 'hero',
      titleAr: 'قسم البطل (Hero)',
      titleEn: 'Hero Header',
      descAr: 'الواجهة الرئيسية بالشعار، العناوين الجذابة، وزر واتساب الرئيسي.',
      descEn: 'Top landing header with brand logo, main CTAs, and quick highlights.'
    },
    {
      type: 'services',
      titleAr: 'شبكة الخدمات (Services Grid)',
      titleEn: 'Services Grid',
      descAr: 'بطاقات الخدمات الست الأساسية للتكييف والغسالات والتبريد.',
      descEn: 'Service cards showcasing AC, refrigeration, and appliance repairs.'
    },
    {
      type: 'copper',
      titleAr: 'تمديد النحاس (Copper Piping)',
      titleEn: 'Copper Piping Rough-in',
      descAr: 'عرض تفصيلي لأنواع النحاس الأمريكي والكوري ومراحل التأسيس.',
      descEn: 'American, Korean & Chinese copper specs and wall rough-in showcase.'
    },
    {
      type: 'gallery',
      titleAr: 'معرض الأعمال (Gallery)',
      titleEn: 'Photo Gallery',
      descAr: 'معرض الصور الحقيقية المصنفة مع نافذة العرض المكبرة.',
      descEn: 'Fieldwork portfolio with category filtering and interactive lightbox.'
    },
    {
      type: 'contact',
      titleAr: 'التواصل ونموذج الطلب (Contact)',
      titleEn: 'Contact & Form',
      descAr: 'بيانات التواصل المباشر ونموذج الاستفسار السريع المحول لواتساب.',
      descEn: 'Direct contact card and auto-formatted WhatsApp inquiry form.'
    },
    {
      type: 'cta-banner',
      titleAr: 'بانر الحث على اتخاذ إجراء (CTA)',
      titleEn: 'Call to Action Banner',
      descAr: 'شريط زجاجي عريض لجذب العميل للتواصل الفوري عبر واتساب أو الهاتف.',
      descEn: 'High-impact conversion banner with direct WhatsApp / phone triggers.'
    },
    {
      type: 'faq',
      titleAr: 'الأسئلة الشائعة (FAQ)',
      titleEn: 'FAQ Accordion',
      descAr: 'قائمة إجابات وافية تعزز ثقة العميل وتحسن محركات البحث (SEO).',
      descEn: 'Collapsible accordion answering common questions and boosting SEO.'
    },
    {
      type: 'testimonials',
      titleAr: 'آراء وتقييمات العملاء (Reviews)',
      titleEn: 'Testimonials',
      descAr: 'عرض تقييمات العملاء الموثقة مع النجوم والموقع ونوع الخدمة.',
      descEn: 'Verified client feedback with 5-star ratings and service badges.'
    },
    {
      type: 'text-image',
      titleAr: 'نص وصورة توضيحية (Story)',
      titleEn: 'Text & Media Story',
      descAr: 'تخطيط مرن لعرض معايير السلامة، قصة المؤسسة أو معايير الجودة.',
      descEn: 'Split 50/50 layout for company standards, stories, or announcements.'
    }
  ];

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 rtl:border-r-0 rtl:border-l flex flex-col h-[calc(100vh-4rem)] z-20 select-none">
      {/* Panel Top Tabs */}
      <div className="p-3 border-b border-slate-800 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('tree')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'tree'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isAr ? 'هيكل الصفحة' : 'Page Outline'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {sections.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'library'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAr ? 'إضافة قسم' : 'Add Section'}</span>
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'tree' ? (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400 px-1">
              <span>{isAr ? 'الأقسام الحالية (اسحب للترتيب):' : 'Current Sections (Drag to reorder):'}</span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {sections.map(section => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                    isSelected={selectedSectionId === section.id}
                    onSelect={() => selectSection(section.id)}
                    onToggleVisibility={() => toggleSectionVisibility(section.id)}
                    onDuplicate={() => duplicateSection(section.id)}
                    onDelete={() => deleteSection(section.id)}
                    isAr={isAr}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Quick Add at bottom of tree */}
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className="w-full mt-3 py-2.5 px-3 border border-dashed border-slate-700 hover:border-sky-500 rounded-xl text-xs font-semibold text-slate-400 hover:text-sky-400 hover:bg-sky-500/5 flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة قسم جديد للصفحة' : 'Add New Section'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="mb-2 text-xs text-slate-400 px-1">
              <span>{isAr ? 'اختر نوع القسم لإدراجه فورًا:' : 'Choose a section to append:'}</span>
            </div>

            {AVAILABLE_SECTION_TYPES.map(item => (
              <div
                key={item.type}
                onClick={() => {
                  addSection(item.type);
                  setActiveTab('tree');
                }}
                className="group p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-800/80 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 group-hover:border-sky-500/40">
                    {getSectionIcon(item.type)}
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 group-hover:text-sky-300">
                    {isAr ? item.titleAr : item.titleEn}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAr ? item.descAr : item.descEn}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
