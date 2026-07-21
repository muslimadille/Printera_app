import React, { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Maximize2 } from 'lucide-react';

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
  showDimensions,
  onShowDimensionsChange,
  dimUnit,
  onDimUnitChange,
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
      {/* ──── Top Bar ──── */}
      <header className="editor-header">
        <div className="editor-header__title-row">
          <h1 className="editor-header__title">{title}</h1>
          {headerActions && (
            <div className="editor-header__actions">{headerActions}</div>
          )}
        </div>
      </header>

      {/* ──── Top Panels (admin / reference mode) ──── */}
      {topPanels}

      {/* ──── Main Canvas ──── */}
      <div className="editor-body">
        {/* ─── Preview Column ─── */}
        <main className="editor-preview">
          {/* Toolbar */}
          <div className="editor-toolbar">
            {/* Tabs */}
            <nav className="editor-tabs">
              {modes.filter(m => m.show).map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onPreviewModeChange(m.key)}
                  className={`editor-tab ${previewMode === m.key ? 'editor-tab--active' : ''}`}
                >
                  {modeLabels[m.key]}
                </button>
              ))}
            </nav>

            {/* Quick controls */}
            <div className="editor-toolbar__controls">
              {previewMode === 'template' && onShowDimensionsChange !== undefined && (
                <div className="editor-toolbar__toggle">
                  <Switch
                    id="layout-show-dims"
                    checked={showDimensions}
                    onCheckedChange={onShowDimensionsChange}
                  />
                  <Label htmlFor="layout-show-dims" className="editor-toolbar__toggle-label">
                    القياسات
                  </Label>
                </div>
              )}

              <Select value={dimUnit} onValueChange={(val: 'mm' | 'cm' | 'in') => onDimUnitChange(val)}>
                <SelectTrigger className="editor-toolbar__unit-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mm">mm</SelectItem>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="in">in</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action buttons */}
            <div className="editor-toolbar__actions">
              {actionButtons}
            </div>
          </div>

          {/* Canvas area */}
          <div className="editor-canvas">
            {previewArea}
            {previewMode === 'sheet' && floatingSummary}
          </div>
        </main>

        {/* ─── Sidebar ─── */}
        <aside className="editor-sidebar">
          <div className="editor-sidebar__inner">
            {sidebarArea}
          </div>
        </aside>
      </div>

      {/* ──── Scoped Styles ──── */}
      <style>{`
        /* ═══════════════════════════════════════════
           Editor Root
           ═══════════════════════════════════════════ */
        .editor-root {
          display: flex;
          flex-direction: column;
          gap: 0;
          min-height: calc(100vh - 80px);
          background: var(--brand-bg, #F5F6F8);
        }

        /* ═══════ Header ═══════ */
        .editor-header {
          background: #fff;
          border-bottom: 1px solid var(--brand-border, #E3E6EA);
          padding: 14px 24px;
        }
        .editor-header__title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .editor-header__title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--brand-navy, #0F1D2D);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .editor-header__actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* ═══════ Body (Preview + Sidebar) ═══════ */
        .editor-body {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 0;
          flex: 1;
          min-height: 0;
        }
        @media (max-width: 1024px) {
          .editor-body {
            grid-template-columns: 1fr;
          }
        }

        /* ═══════ Preview Column ═══════ */
        .editor-preview {
          display: flex;
          flex-direction: column;
          min-height: 0;
          border-left: 1px solid var(--brand-border, #E3E6EA);
        }

        /* ─── Toolbar ─── */
        .editor-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          background: #fff;
          border-bottom: 1px solid var(--brand-border, #E3E6EA);
          flex-wrap: wrap;
        }
        .editor-tabs {
          display: flex;
          gap: 4px;
          background: var(--brand-bg, #F5F6F8);
          border-radius: 10px;
          padding: 3px;
        }
        .editor-tab {
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--brand-muted, #4A5A6D);
          background: transparent;
          white-space: nowrap;
        }
        .editor-tab:hover {
          background: rgba(15, 29, 45, 0.06);
        }
        .editor-tab--active {
          background: var(--brand-navy, #0F1D2D) !important;
          color: #fff !important;
          box-shadow: 0 2px 8px rgba(15, 29, 45, 0.18);
        }

        .editor-toolbar__controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-right: auto;
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
          color: var(--brand-muted, #4A5A6D);
          user-select: none;
        }
        .editor-toolbar__unit-select {
          width: 68px;
          height: 32px;
          font-size: 12px;
          font-weight: 600;
          background: #fff;
          border: 1px solid var(--brand-border, #E3E6EA);
          border-radius: 8px;
        }
        .editor-toolbar__actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* ─── Canvas ─── */
        .editor-canvas {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          padding: 24px;
          background: var(--brand-bg, #F5F6F8);
          position: relative;
          overflow: auto;
          min-height: 520px;
        }
        .editor-canvas > * {
          width: 100%;
        }

        /* ═══════ Sidebar ═══════ */
        .editor-sidebar {
          background: #fff;
          border-right: none;
          overflow-y: auto;
          max-height: calc(100vh - 80px);
        }
        .editor-sidebar__inner {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ─── Sidebar Section Styling ─── */
        .editor-sidebar__inner > section,
        .editor-sidebar__inner > div {
          /* No extra margin needed, gap handles it */
        }
        .editor-sidebar__inner h3 {
          font-size: 13px;
          font-weight: 700;
          color: var(--brand-navy, #0F1D2D);
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--brand-gold, #C89D63);
          letter-spacing: 0.01em;
        }

        /* ─── Responsive ─── */
        @media (max-width: 1024px) {
          .editor-preview {
            border-left: none;
          }
          .editor-sidebar {
            border-top: 1px solid var(--brand-border, #E3E6EA);
            max-height: none;
          }
          .editor-canvas {
            min-height: 400px;
          }
        }
        @media (max-width: 640px) {
          .editor-header {
            padding: 12px 16px;
          }
          .editor-toolbar {
            padding: 8px 12px;
          }
          .editor-canvas {
            padding: 16px;
            min-height: 320px;
          }
          .editor-sidebar__inner {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
