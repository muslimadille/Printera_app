import React, { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Box, RotateCcw, Save } from 'lucide-react';

export type PreviewMode = 'template' | 'sheet' | 'three' | 'single';

interface TemplateEditorLayoutProps {
  title: string;
  headerActions?: ReactNode;
  topPanels?: ReactNode;

  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;

  hasTemplatePreview?: boolean;
  hasSinglePreview?: boolean;
  hasSheetPreview?: boolean;
  has3DPreview?: boolean;

  // Reference mode (rendered by each calculator, just accepted here for TS compat)
  hasReferenceMode?: boolean;
  referenceModeOn?: boolean;
  onReferenceModeChange?: (val: boolean) => void;

  showDimensions?: boolean;
  onShowDimensionsChange?: (val: boolean) => void;
  dimUnit: 'mm' | 'cm' | 'in';
  onDimUnitChange: (val: 'mm' | 'cm' | 'in') => void;
  dimScale?: number;
  onDimScaleChange?: (val: number) => void;
  onSave?: () => void;
  onReset?: () => void;

  actionButtons?: ReactNode;
  previewArea: ReactNode;
  sidebarArea: ReactNode;
  floatingSummary?: ReactNode;
}

const modeLabels: Record<PreviewMode, string> = {
  template: 'القالب',
  single: 'قطعة مفردة',
  sheet: 'التوزيع',
  three: '3D',
};

export function TemplateEditorLayout({
  title,
  headerActions,
  topPanels,
  previewMode,
  onPreviewModeChange,
  hasTemplatePreview = true,
  hasSinglePreview = false,
  hasSheetPreview = true,
  has3DPreview = false,
  showDimensions = true,
  onShowDimensionsChange,
  dimUnit,
  onDimUnitChange,
  dimScale,
  onDimScaleChange,
  onSave,
  onReset,
  actionButtons,
  previewArea,
  sidebarArea,
  floatingSummary,
}: TemplateEditorLayoutProps) {

  const modes: { key: PreviewMode; show: boolean }[] = [
    { key: 'template', show: hasTemplatePreview },
    { key: 'single', show: hasSinglePreview },
    { key: 'sheet', show: hasSheetPreview },
    { key: 'three', show: has3DPreview },
  ];

  return (
    <div dir="rtl" className="editor-root">
      {/* ──── Top Header ──── */}
      <header className="editor-header">
        <div className="editor-header__brand">
          <img src="/brand/printera-logo-trans.png" alt="Printera" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <h1 className="editor-header__title">{title}</h1>
        </div>

        <div className="editor-header__actions">
          {actionButtons}
          {headerActions}
        </div>
      </header>

      {/* ──── Top Panels (admin / reference mode if active) ──── */}
      {topPanels}

      {/* ──── Main Editor Body ──── */}
      <div className="editor-body">
        {/* ─── Sidebar (Right Side in RTL) ─── */}
        <aside className="editor-sidebar">
          <div className="editor-sidebar__container">
            {/* View Mode Tabs at top of sidebar */}
            <div className="pb-3.5 border-b border-slate-100">
              <nav className={`grid gap-1.5 bg-slate-100 p-1 rounded-xl ${
                modes.filter(m => m.show).length === 4 ? 'grid-cols-4' : 
                modes.filter(m => m.show).length === 3 ? 'grid-cols-3' : 'grid-cols-2'
              }`}>
                {modes.filter(m => m.show).map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onPreviewModeChange(m.key)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      previewMode === m.key
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {modeLabels[m.key]}
                  </button>
                ))}
              </nav>
            </div>

            {/* Unit Selection & Dimension Scale Slider (Dropdown on the left in RTL) */}
            <div className="pt-3.5 pb-3.5 mb-3 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2.5">
                {/* Dimensions Scale Slider & Label */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">حجم القياسات</Label>
                  {showDimensions && onDimScaleChange && (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={dimScale ?? 1}
                        onChange={e => onDimScaleChange(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="text-[10px] font-semibold text-slate-500 w-7 text-left shrink-0" dir="ltr">
                        {Math.round((dimScale ?? 1) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Unit Selection Dropdown (placed to the left in RTL) */}
                <Select value={dimUnit} onValueChange={(val: 'mm' | 'cm' | 'in') => onDimUnitChange(val)}>
                  <SelectTrigger className="w-[68px] h-8 text-xs font-semibold bg-slate-50 border-slate-200 rounded-lg shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="in">in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sidebarArea}
          </div>

          {/* Fixed Bottom Action Buttons (Outside Scroll) */}
          <div className="pt-3 border-t border-slate-200 flex items-center gap-2 flex-shrink-0 bg-slate-50/80 backdrop-blur-sm rounded-b-xl px-1">
            <Button
              type="button"
              onClick={onSave ? onSave : () => alert('تم تطبيق التعديلات بنجاح')}
              className="flex-1 bg-slate-900 text-white hover:bg-slate-800 h-9 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>تطبيق التعديلات</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onReset ? onReset : () => alert('تم إعادة تعيين التعديلات بنجاح')}
              className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-100 h-9 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 bg-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة التعيين</span>
            </Button>
          </div>
        </aside>

        {/* ─── Preview Canvas Area (Left Side in RTL) ─── */}
        <main className="editor-preview">
          {/* Canvas View Container */}
          <div className="editor-canvas-wrapper">
            <div className="editor-canvas">
              {previewArea}
              {previewMode === 'sheet' && floatingSummary}
            </div>
          </div>
        </main>
      </div>

      {/* ──── Custom CSS ──── */}
      <style>{`
        .editor-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          min-height: 100vh;
          background: #f1f5f9;
          font-family: inherit;
          overflow: hidden;
        }

        /* Top Header */
        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
          padding: 0 24px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          z-index: 20;
          flex-shrink: 0;
        }

        .editor-header__brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .editor-header__icon-box {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dbeafe;
        }

        .editor-header__title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .editor-header__actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Body Layout: Sidebar on Right, Canvas on Left in RTL */
        .editor-body {
          display: flex;
          flex: 1;
          height: calc(100vh - 60px);
          min-height: 0;
          gap: 16px;
          padding: 16px;
          overflow: hidden;
        }

        /* Sidebar Container (White Card with Rounded Corners on the Right) */
        .editor-sidebar {
          width: 340px;
          flex-shrink: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .editor-sidebar__container {
          background: transparent;
          border-radius: 0;
          border: none;
          box-shadow: none;
          padding: 4px 12px 4px 8px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0;
          direction: ltr; /* Moves scrollbar track to the right edge */
        }

        .editor-sidebar__container > * {
          direction: rtl; /* Maintains RTL text layout for sidebar items */
        }

        /* Scrollbar styling: hidden by default, visible on hover */
        .editor-sidebar__container::-webkit-scrollbar {
          width: 6px;
        }

        .editor-sidebar__container::-webkit-scrollbar-track {
          background: transparent;
        }

        .editor-sidebar__container::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 9999px;
        }

        .editor-sidebar__container:hover::-webkit-scrollbar-thumb {
          background: #cbd5e1;
        }

        .editor-sidebar__container:hover::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .editor-sidebar__container h3 {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
          padding-bottom: 0;
        }

        /* Preview Canvas Container */
        .editor-preview {
          flex: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 12px;
        }

        .editor-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 48px;
          padding: 0 16px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          flex-shrink: 0;
        }

        .editor-tabs {
          display: flex;
          gap: 4px;
          background: #f8fafc;
          border-radius: 8px;
          padding: 3px;
        }

        .editor-tab {
          padding: 5px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #64748b;
          background: transparent;
          white-space: nowrap;
        }

        .editor-tab:hover {
          background: rgba(15, 23, 42, 0.05);
        }

        .editor-tab--active {
          background: #0f172a !important;
          color: #ffffff !important;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
        }

        .editor-toolbar__controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .editor-toolbar__toggle {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .editor-toolbar__toggle-label {
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          color: #475569;
        }

        .editor-toolbar__unit-select {
          width: 68px;
          height: 32px;
          font-size: 12px;
          font-weight: 600;
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
        }

        .editor-canvas-wrapper {
          flex: 1;
          height: 100%;
          min-height: 0;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
          overflow: hidden;
          position: relative;
        }

        .editor-canvas {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          flex: 1;
          position: relative;
        }

        .editor-canvas > svg {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
        }

        @media (max-width: 1024px) {
          .editor-body {
            flex-direction: column;
            overflow-y: auto;
            height: auto;
          }
          .editor-sidebar {
            width: 100%;
            height: auto;
          }
          .editor-preview {
            height: 500px;
          }
        }
      `}</style>
    </div>
  );
}
