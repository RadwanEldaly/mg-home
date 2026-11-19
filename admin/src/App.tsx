// ============================================================================
// MG HOME CMS — Main Application Shell (v2.3.0)
// File: admin/src/App.tsx
// ============================================================================

import React, { useState } from 'react';
import { CMSProvider, useCMS } from './context/CMSContext';
import { AdminHeader } from './components/layout/AdminHeader';
import { LeftPanel } from './components/builder/LeftPanel';
import { CenterCanvas } from './components/builder/CenterCanvas';
import { RightInspector } from './components/builder/RightInspector';
import { LoginModal } from './components/auth/LoginModal';
import { PublishModal } from './components/modals/PublishModal';
import { RevisionHistoryModal } from './components/modals/RevisionHistoryModal';
import { SiteSettingsModal } from './components/modals/SiteSettingsModal';

const StudioContent: React.FC = () => {
  const { activeLanguage } = useCMS();
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  return (
    <div 
      className="min-h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100"
      dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Top Admin Header */}
      <AdminHeader
        onOpenPublishModal={() => setIsPublishModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* 3-Panel Studio Layout */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-4rem)]">
        {/* Panel 1: Left Outline & Library */}
        <LeftPanel />

        {/* Panel 2: Center Live Canvas */}
        <CenterCanvas />

        {/* Panel 3: Right Inspector */}
        <RightInspector />
      </div>

      {/* Modals & Dialogs */}
      <LoginModal />
      <PublishModal 
        isOpen={isPublishModalOpen} 
        onClose={() => setIsPublishModalOpen(false)} 
      />
      <RevisionHistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
      />
      <SiteSettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />
    </div>
  );
};

export default function App() {
  return (
    <CMSProvider>
      <StudioContent />
    </CMSProvider>
  );
}
