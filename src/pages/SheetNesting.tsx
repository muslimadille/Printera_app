import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { toast } from 'sonner';
import {
  Upload,
  Sparkles,
  Download,
  FileCode,
  FileText,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Layers,
  Zap,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Percent,
  Check,
  ShieldCheck,
  Package,
  Boxes,
  Compass,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import {
  ParsedDieSvg,
  NestingLayoutResult,
  parseSvgString,
  computeOptimalNesting,
  generateExportSvg,
  exportLayoutAsPdf
} from '@/lib/sheetDistributionEngine';

// Quick Preset sample templates built into the system
const SAMPLE_TEMPLATES = [
  { id: 'T0002', name: 'علبة قابلة للطي (Straight Tuck)', path: '/templates/preview/T0002.svg' },
  { id: 'T0005', name: 'علبة قاع أوتوماتيكي (Crash Lock)', path: '/templates/preview/T0005.svg' },
  { id: 'D001-H', name: 'علبة شحن بريدية (Mailer Box)', path: '/templates/preview/D001-H.svg' },
  { id: 'fefco_0427', name: 'علبة بيتزا وتغليف (FEFCO 0427)', path: '/templates/preview/fefco_0427.svg' },
];

const PRESET_SHEET_SIZES = [
  { label: '35 × 50 cm', widthMm: 500, heightMm: 350 },
  { label: '50 × 70 cm', widthMm: 700, heightMm: 500 },
  { label: '70 × 100 cm', widthMm: 1000, heightMm: 700 },
  { label: '100 × 140 cm', widthMm: 1400, heightMm: 1000 },
];

export default function SheetNesting() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SVG State
  const [parsedDie, setParsedDie] = useState<ParsedDieSvg | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('T0002');
  const [loadingSvg, setLoadingSvg] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Sheet Settings
  const [sheetW, setSheetW] = useState<number>(1000);
  const [sheetH, setSheetH] = useState<number>(700);
  const [gapMm, setGapMm] = useState<number>(0);
  const [marginMm, setMarginMm] = useState<number>(5);
  const [activePreset, setActivePreset] = useState<string>('70 × 100 cm');
  const [nestingMode, setNestingMode] = useState<'same_orientation' | 'all'>('same_orientation');
  const [selectedStrategyIndex, setSelectedStrategyIndex] = useState<number>(0);

  // Calculation Result
  const [nestingResult, setNestingResult] = useState<NestingLayoutResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Canvas View Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showNumbers, setShowNumbers] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Load default template on mount
  useEffect(() => {
    loadSampleTemplate('T0002');
  }, []);

  // Compute nesting when parsedDie, sheet dimensions, or nestingMode change
  useEffect(() => {
    if (parsedDie) {
      handleCalculateNesting();
    }
  }, [parsedDie, sheetW, sheetH, gapMm, marginMm, nestingMode]);

  // Load a sample SVG template from public folder
  const loadSampleTemplate = async (sampleId: string) => {
    const sample = SAMPLE_TEMPLATES.find((s) => s.id === sampleId);
    if (!sample) return;
    setLoadingSvg(true);
    try {
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error('تعذر تحميل القالب التجريبي');
      const svgText = await res.text();
      const parsed = parseSvgString(svgText, `${sample.id}.svg`);
      setParsedDie(parsed);
      setSelectedSampleId(sampleId);
      setSelectedStrategyIndex(0);
      toast.success(`تم تحميل ${sample.name}`);
    } catch (err: any) {
      toast.error(err.message || 'خطأ أثناء قراءة القالب');
    } finally {
      setLoadingSvg(false);
    }
  };

  // Handle User File Upload
  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      toast.error('يرجى رفع ملف بصيغة SVG فقط');
      return;
    }
    setLoadingSvg(true);
    // Use requestAnimationFrame / setTimeout to prevent UI blocking
    await new Promise((resolve) => setTimeout(resolve, 10));
    try {
      const text = await file.text();
      const parsed = parseSvgString(text, file.name);
      setParsedDie(parsed);
      setSelectedSampleId('');
      setSelectedStrategyIndex(0);
      toast.success(`تم استيراد ${file.name} بنجاح (${parsed.widthMm} × ${parsed.heightMm} مم)`);
    } catch (err: any) {
      toast.error(err.message || 'تعذر قراءة ملف الـ SVG');
    } finally {
      setLoadingSvg(false);
    }
  };

  // Select Preset Size
  const handleSelectPreset = (preset: typeof PRESET_SHEET_SIZES[0]) => {
    setActivePreset(preset.label);
    setSheetW(preset.widthMm);
    setSheetH(preset.heightMm);
  };

  // Calculate Nesting
  const handleCalculateNesting = () => {
    if (!parsedDie) {
      toast.error('يرجى رفع أو اختيار ملف SVG أولاً');
      return;
    }
    setIsCalculating(true);
    setTimeout(() => {
      try {
        const result = computeOptimalNesting(parsedDie, {
          sheetWidthMm: sheetW,
          sheetHeightMm: sheetH,
          gapMm,
          marginMm,
          allowInversion: nestingMode === 'all',
          strategyType: nestingMode === 'same_orientation' ? 'same_orientation' : 'all',
        });
        setNestingResult(result);
        setSelectedStrategyIndex(0);
      } catch (e: any) {
        toast.error('حدث خطأ أثناء حساب التعشيق');
      } finally {
        setIsCalculating(false);
      }
    }, 10);
  };

  // Current selected strategy layout
  const currentLayout = useMemo(() => {
    if (!nestingResult) return null;
    if (nestingResult.allStrategies && nestingResult.allStrategies[selectedStrategyIndex]) {
      return nestingResult.allStrategies[selectedStrategyIndex];
    }
    return nestingResult;
  }, [nestingResult, selectedStrategyIndex]);

  // Download SVG
  const handleDownloadSvg = () => {
    if (!currentLayout) return;
    try {
      const svgMarkup = generateExportSvg(currentLayout);
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Printera-${currentLayout.parsedDie.fileName || 'die'}-${sheetW}x${sheetH}mm-nesting.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('تم تحميل ملف SVG بنجاح');
    } catch {
      toast.error('تعذر تصدير ملف SVG');
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (!currentLayout) return;
    setIsExportingPdf(true);
    try {
      await exportLayoutAsPdf(currentLayout);
      toast.success('تم تصدير وتحميل ملف PDF بنجاح');
    } catch (err: any) {
      toast.error('تعذر تصدير ملف PDF للطباعة');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif",
      }}
    >
      {/* Header */}
      <Header variant="simple" active="nesting" bg="#ffffff" />

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 80px' }}>
        
        {/* ========================================================
            HERO SECTION
            ======================================================== */}
        <section
          style={{
            textAlign: 'center',
            padding: '50px 10px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Main Title */}
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 44px)',
              fontWeight: 800,
              color: '#0F172A',
              margin: '0 0 14px 0',
              letterSpacing: '-0.02em',
            }}
          >
            كم يفصل قالب؟
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 'clamp(16px, 2.5vw, 19px)',
              color: '#475569',
              maxWidth: '680px',
              margin: '0 0 32px 0',
              lineHeight: 1.6,
            }}
          >
            ارفع أي قالب SVG وسنحسب لك أفضل توزيع له داخل الشيت بأعلى استغلال للمساحة وفي ثوان معدودة.
          </p>

          {/* Hero Conversion Diagram (Single Die -> Nested Sheet) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              maxWidth: '680px',
              width: '100%',
              margin: '0 auto 36px',
              padding: '20px',
              background: '#FAF9F5',
              borderRadius: '16px',
              border: '1px solid #EAE7DC',
            }}
            className="hero-diagram-box"
          >
            {/* Single Die Box */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '140px',
                  height: '130px',
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <img
                  src="/templates/preview/T0002.svg"
                  alt="Single Die"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>قالب مفرد (1)</span>
            </div>

            {/* Transform Arrow */}
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#007BFF',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)',
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={20} />
            </div>

            {/* Nested Sheet Box */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '200px',
                  height: '130px',
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  boxShadow: '0 4px 14px rgba(0, 123, 255, 0.08)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Visual grid illustration */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridTemplateRows: 'repeat(2, 1fr)',
                    gap: '4px',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src="/templates/preview/T0002.svg"
                        alt="Mini"
                        style={{ width: '80%', height: '80%', objectFit: 'contain', opacity: 0.85 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#007BFF' }}>
                شيت معشق بالكامل (أقصى عدد)
              </span>
            </div>
          </div>

          {/* 3 Value Pillars */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '40px',
              flexWrap: 'wrap',
              margin: '0 auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#EFF6FF',
                  color: '#007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Compass size={18} />
              </div>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#1E293B' }}>يقبل أي ملف SVG</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCw size={18} />
              </div>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#1E293B' }}>
                توزيع ذكي وتدوير تلقائي
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Percent size={18} />
              </div>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#1E293B' }}>
                أعلى استغلال للمساحة
              </span>
            </div>
          </div>
        </section>


        {/* ========================================================
            INTERACTIVE CALCULATOR CARD
            ======================================================== */}
        <section
          style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
            padding: '32px',
            marginBottom: '48px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '36px',
            }}
            className="calc-grid-row"
          >
            {/* LEFT COLUMN: UPLOAD & TEMPLATE PICKER */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFileUpload(e.target.files?.[0] || null);
                  // Reset input value so re-selecting same file works
                  e.target.value = '';
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0] || null;
                  handleFileUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isDragging ? '2px dashed #007BFF' : parsedDie ? '1.5px solid #CBD5E1' : '2px dashed #93C5FD',
                  borderRadius: '16px',
                  padding: parsedDie ? '18px' : '32px 20px',
                  background: isDragging ? '#EFF6FF' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  minHeight: '220px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                className="dropzone-area"
              >
                {parsedDie ? (
                  /* Loaded SVG Preview Inside the Dropzone */
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Top Bar inside Dropzone */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#FFFFFF',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#F0FDF4',
                            color: '#16A34A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={14} />
                        </div>
                        <span style={{ fontWeight: 700, color: '#0F172A', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {parsedDie.fileName}
                        </span>
                        <span style={{ color: '#64748B', fontSize: '12px', fontWeight: 600 }}>
                          ({parsedDie.widthMm} × {parsedDie.heightMm} مم)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        style={{
                          background: '#EFF6FF',
                          color: '#007BFF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Upload size={13} />
                        <span>تغيير الملف</span>
                      </button>
                    </div>

                    {/* SVG Visual Graphic Preview */}
                    <div
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        height: '130px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px',
                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.02)',
                        overflow: 'hidden',
                      }}
                    >
                      <svg
                        viewBox={`${parsedDie.vbX} ${parsedDie.vbY} ${parsedDie.vbW} ${parsedDie.vbH}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto',
                        }}
                      >
                        <g
                          stroke="#007BFF"
                          fill="none"
                          strokeWidth={Math.min(parsedDie.vbW, parsedDie.vbH) * 0.003 || 1}
                          dangerouslySetInnerHTML={{ __html: parsedDie.innerSvg }}
                        />
                      </svg>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                      اسحب ملف SVG جديد هنا للاستبدال أو انقر لتغيير القالب
                    </div>
                  </div>
                ) : (
                  /* Empty Dropzone State */
                  <>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: '#EFF6FF',
                        color: '#007BFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <Upload size={28} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                      {loadingSvg ? 'جاري قراءة الملف...' : 'اسحب ملف SVG هنا'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '14px' }}>أو</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{
                        background: '#007BFF',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 24px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(0, 123, 255, 0.2)',
                      }}
                    >
                      <FileCode size={16} />
                      <span>{loadingSvg ? 'جاري التحميل...' : 'اختر ملف SVG'}</span>
                    </button>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '12px' }}>
                      يفضل أن يكون الملف بوحدة mm
                    </div>
                  </>
                )}
              </div>

              {/* Sample Templates Quick Selector */}
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Package size={14} color="#007BFF" />
                  <span>أو جرّب أحد القوالب الجاهزة:</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SAMPLE_TEMPLATES.map((sample) => {
                    const isSelected = selectedSampleId === sample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => loadSampleTemplate(sample.id)}
                        style={{
                          background: isSelected ? '#EFF6FF' : '#F1F5F9',
                          border: isSelected ? '1.5px solid #007BFF' : '1px solid #E2E8F0',
                          color: isSelected ? '#007BFF' : '#334155',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && <Check size={14} />}
                        <span>{sample.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: SHEET DIMENSIONS & CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header & Presets */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                      مقاس الشيت
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#007BFF', fontWeight: 600 }}>
                      مقاسات شائعة
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                    }}
                    className="preset-pills-row"
                  >
                    {PRESET_SHEET_SIZES.map((preset) => {
                      const isSelected = activePreset === preset.label;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          style={{
                            background: isSelected ? '#EFF6FF' : '#FFFFFF',
                            border: isSelected ? '2px solid #007BFF' : '1px solid #CBD5E1',
                            color: isSelected ? '#007BFF' : '#334155',
                            borderRadius: '10px',
                            padding: '10px 4px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Dimensions Inputs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>
                      العرض (mm)
                    </label>
                    <input
                      type="number"
                      value={sheetW}
                      onChange={(e) => {
                        setSheetW(Number(e.target.value) || 0);
                        setActivePreset('');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#0F172A',
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#94A3B8', marginTop: '20px' }}>×</span>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>
                      الارتفاع (mm)
                    </label>
                    <input
                      type="number"
                      value={sheetH}
                      onChange={(e) => {
                        setSheetH(Number(e.target.value) || 0);
                        setActivePreset('');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#0F172A',
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Gap & Margins row */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                      المسافة البينية (Gap mm)
                    </label>
                    <input
                      type="number"
                      value={gapMm}
                      onChange={(e) => setGapMm(Math.max(0, Number(e.target.value) || 0))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '14px',
                        color: '#0F172A',
                        textAlign: 'center',
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                      هامش الحواف (Margin mm)
                    </label>
                    <input
                      type="number"
                      value={marginMm}
                      onChange={(e) => setMarginMm(Math.max(0, Number(e.target.value) || 0))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '14px',
                        color: '#0F172A',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                </div>

                {/* Nesting Mode Selector */}
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    نمط التداخل والتوزيع (Nesting Mode)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setNestingMode('same_orientation')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: `1.5px solid ${nestingMode === 'same_orientation' ? '#007BFF' : '#E2E8F0'}`,
                        background: nestingMode === 'same_orientation' ? '#EFF6FF' : '#FFFFFF',
                        color: nestingMode === 'same_orientation' ? '#007BFF' : '#475569',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>نفس الاتجاه 🎯</span>
                      <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.8 }}>تداخل مستقيم متوافق</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNestingMode('all')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: `1.5px solid ${nestingMode === 'all' ? '#007BFF' : '#E2E8F0'}`,
                        background: nestingMode === 'all' ? '#EFF6FF' : '#FFFFFF',
                        color: nestingMode === 'all' ? '#007BFF' : '#475569',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>تعشيق حر 🔄</span>
                      <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.8 }}>مع قلب 180° / حر</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculate Button */}
              <button
                type="button"
                onClick={handleCalculateNesting}
                disabled={isCalculating || !parsedDie}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  background: '#007BFF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 6px 18px rgba(0, 123, 255, 0.28)',
                  transition: 'all 0.2s ease',
                }}
                className="btn-calculate"
              >
                <Zap size={20} fill="#FFFFFF" />
                <span>{isCalculating ? 'جاري الحساب...' : 'احسب أفضل توزيع'}</span>
              </button>
            </div>
          </div>
        </section>


        {/* ========================================================
            RESULTS SECTION ("نتيجة التوزيع")
            ======================================================== */}
        <section style={{ marginBottom: '60px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#0F172A',
                margin: '0 0 6px 0',
              }}
            >
              نتيجة التوزيع والتعشيق الذكي
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              مخطط توزيع الشيت مع حساب الاستغلال الأمثل وتقليل الهدر
            </p>
          </div>

          {/* TOP METRICS STRIP (4 CARDS) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* Stat 1: Die Count */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>
                  عدد القوالب في الشيت
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                  {currentLayout ? `${currentLayout.count} قطعة` : '—'}
                </div>
              </div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Boxes size={24} />
              </div>
            </div>

            {/* Stat 2: Utilization % */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>
                  نسبة الاستغلال
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                  {currentLayout ? `${currentLayout.utilizationPercent}%` : '—'}
                </div>
              </div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Percent size={24} />
              </div>
            </div>

            {/* Stat 3: Waste % */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>
                  نسبة الهدر
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#EF4444', marginTop: '2px' }}>
                  {currentLayout ? `${currentLayout.wastePercent}%` : '—'}
                </div>
              </div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#FEF2F2',
                  color: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={24} />
              </div>
            </div>

            {/* Stat 4: Sheet Dimensions */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>
                  أبعاد ومساحة الشيت
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                  {sheetW / 10} × {sheetH / 10} سم
                </div>
                <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>
                  {currentLayout ? `${(currentLayout.sheetAreaMm2).toLocaleString()} مم²` : '—'}
                </div>
              </div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#F8FAFC',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={24} />
              </div>
            </div>
          </div>

          {/* MAIN INTERACTIVE CANVAS CARD */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 6px 24px rgba(0,0,0,0.04)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Top Toolbar Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid #F1F5F9',
                marginBottom: '14px',
              }}
            >
              {/* Active Strategy Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#EFF6FF',
                    color: '#007BFF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={16} />
                  <span>{currentLayout ? currentLayout.strategyName : 'التوزيع الأمثل'}</span>
                </span>

                <span
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                  }}
                >
                  {sheetW / 10} × {sheetH / 10} سم (هامش {marginMm} مم)
                </span>
              </div>

              {/* Action Buttons & Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Toggle Numbers checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer', padding: '6px 10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <input
                    type="checkbox"
                    checked={showNumbers}
                    onChange={(e) => setShowNumbers(e.target.checked)}
                  />
                  <span>إظهار الأرقام</span>
                </label>

                {/* Export SVG */}
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  disabled={!currentLayout || currentLayout.pieces.length === 0}
                  style={{
                    background: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileCode size={16} />
                  <span>تصدير SVG</span>
                </button>

                {/* Export PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!currentLayout || currentLayout.pieces.length === 0 || isExportingPdf}
                  style={{
                    background: '#007BFF',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0, 123, 255, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileText size={16} />
                  <span>{isExportingPdf ? 'جاري التصدير...' : 'تحميل PDF'}</span>
                </button>
              </div>
            </div>

            {/* STRATEGY SELECTOR PILLS */}
            {nestingResult?.allStrategies && nestingResult.allStrategies.length > 1 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>
                  الاستراتيجيات المحسوبة المتاحة (انقر للتبديل الفوري):
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '6px',
                    maxWidth: '100%',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {nestingResult.allStrategies.slice(0, 8).map((strat, idx) => {
                    const isSelected = selectedStrategyIndex === idx;
                    const cleanName = strat.strategyName
                      .replace(/تعشيق (صفوف|أعمدة) /, '')
                      .replace(/توزيع /, '');

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedStrategyIndex(idx)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 700 : 500,
                          background: isSelected ? '#007BFF' : '#F1F5F9',
                          color: isSelected ? '#FFFFFF' : '#334155',
                          border: `1.5px solid ${isSelected ? '#007BFF' : '#E2E8F0'}`,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{idx === 0 ? '⭐' : '•'}</span>
                        <span>{cleanName}</span>
                        <span
                          style={{
                            background: isSelected ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                            color: isSelected ? '#FFFFFF' : '#475569',
                            borderRadius: '10px',
                            padding: '1px 7px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {strat.count} ق
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Visualizer Canvas Area */}
            <div
              style={{
                width: '100%',
                minHeight: '480px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FAF9F5',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                padding: '24px',
                position: 'relative',
                boxSizing: 'border-box',
              }}
            >
              {/* SVG Sheet Render */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 0.2s ease',
                }}
              >
                <svg
                  viewBox={`0 0 ${sheetW} ${sheetH}`}
                  style={{
                    width: '100%',
                    maxWidth: '860px',
                    maxHeight: '480px',
                    background: '#FFFFFF',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                    borderRadius: '6px',
                  }}
                >
                  {/* Sheet Background Border */}
                  <rect
                    x="0"
                    y="0"
                    width={sheetW}
                    height={sheetH}
                    fill="#FFFFFF"
                    stroke="#0F172A"
                    strokeWidth={Math.min(sheetW, sheetH) * 0.0025}
                  />

                  {/* Usable Area Margin Dashed Border */}
                  <rect
                    x={marginMm}
                    y={marginMm}
                    width={Math.max(1, sheetW - marginMm * 2)}
                    height={Math.max(1, sheetH - marginMm * 2)}
                    fill="none"
                    stroke="#CBD5E1"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />

                  {/* Placed Pieces */}
                  {currentLayout && parsedDie && currentLayout.pieces.map((piece) => {
                    const cx = piece.x + piece.width / 2;
                    const cy = piece.y + piece.height / 2;
                    const mirrorTransform = piece.mirrored ? 'scale(-1, 1)' : '';
                    const tr = `translate(${cx} ${cy}) rotate(${piece.rotation}) ${mirrorTransform} translate(${-parsedDie.widthMm / 2} ${-parsedDie.heightMm / 2})`;

                    return (
                      <g key={piece.id} transform={tr}>
                        {/* Inner SVG of the dieline scaled properly */}
                        <svg
                          x={0}
                          y={0}
                          width={parsedDie.widthMm}
                          height={parsedDie.heightMm}
                          viewBox={`${parsedDie.vbX} ${parsedDie.vbY} ${parsedDie.vbW} ${parsedDie.vbH}`}
                          preserveAspectRatio="none"
                          overflow="visible"
                        >
                          <g dangerouslySetInnerHTML={{ __html: parsedDie.innerSvg }} />
                        </svg>
                        {/* Number Badge */}
                        {showNumbers && (
                          <g>
                            <circle
                              cx={parsedDie.widthMm / 2}
                              cy={parsedDie.heightMm / 2}
                              r={Math.min(parsedDie.widthMm, parsedDie.heightMm) * 0.1}
                              fill="#FFFFFF"
                              fillOpacity={0.85}
                              stroke="#007BFF"
                              strokeWidth={1}
                            />
                            <text
                              x={parsedDie.widthMm / 2}
                              y={parsedDie.heightMm / 2 + 1}
                              fontSize={Math.min(parsedDie.widthMm, parsedDie.heightMm) * 0.11}
                              fill="#007BFF"
                              fontWeight="800"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              style={{ pointerEvents: 'none', userSelect: 'none' }}
                            >
                              {piece.index}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Floating Zoom Controls Toolbar */}
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  zIndex: 5,
                }}
              >
                <button
                  type="button"
                  title="تكبير"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                  style={{
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  title="تصغير"
                  onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.2))}
                  style={{
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  title="إعادة ضبط الحجم"
                  onClick={() => setZoomLevel(1)}
                  style={{
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>


        {/* ========================================================
            FEATURES SECTION ("لماذا برينتيرا؟")
            ======================================================== */}
        <section style={{ padding: '40px 0', borderTop: '1px solid #E2E8F0' }}>
          <h2
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#0F172A',
              textAlign: 'center',
              marginBottom: '36px',
            }}
          >
            لماذا برينتيرا؟
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '16px',
            }}
            className="why-cards-row"
          >
            {/* Feature 1 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '24px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#EFF6FF',
                  color: '#007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Download size={22} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                ملفات جاهزة للطباعة
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
                حمل ملف SVG/PDF جاهز للإرسال المباشر إلى الماكينة.
              </div>
            </div>

            {/* Feature 2 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '24px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={22} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                سرعة عالية
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
                خوارزميات متقدمة تعطيك النتيجة في ثوانٍ معدودة.
              </div>
            </div>

            {/* Feature 3 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '24px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#F3E8FF',
                  color: '#9333EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCw size={22} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                تدوير ذكي
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
                يدور القوالب في جميع الاتجاهات للحصول على أفضل نتيجة.
              </div>
            </div>

            {/* Feature 4 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '24px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Percent size={22} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                استغلال أعلى للمساحة
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
                يعتمد على شكل القالب الحقيقي وليس على المستطيل الخارجي.
              </div>
            </div>

            {/* Feature 5 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '24px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#EFF6FF',
                  color: '#007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Compass size={22} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                يقبل أي قالب
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
                ارفع أي ملف SVG وسيعمل معه بدون الحاجة لتعديلات.
              </div>
            </div>
          </div>
        </section>


        {/* ========================================================
            HOW IT WORKS SECTION ("كيف يعمل؟")
            ======================================================== */}
        <section style={{ padding: '50px 0 40px', borderTop: '1px solid #E2E8F0' }}>
          <h2
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#0F172A',
              textAlign: 'center',
              marginBottom: '38px',
            }}
          >
            كيف يعمل؟
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px',
              position: 'relative',
            }}
            className="how-it-works-row"
          >
            {/* Step 1 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px 18px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 800,
                }}
              >
                1
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                ارفع ملف SVG
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                ارفع قالبك بسهولة من جهازك أو اختر قالباً جاهزاً للتجربة.
              </div>
            </div>

            {/* Step 2 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px 18px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 800,
                }}
              >
                2
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                اختر مقاس الشيت
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                اختر من المقاسات القياسية الجاهزة أو أدخل أبعاد مخصصة.
              </div>
            </div>

            {/* Step 3 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px 18px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 800,
                }}
              >
                3
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                احسب أفضل توزيع
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                يقوم النظام بالتعشيق والتدوير التلقائي لتقليل الهدر.
              </div>
            </div>

            {/* Step 4 */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px 18px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#007BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 800,
                }}
              >
                4
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                احصل على النتيجة
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                عاين الشيت مباشرة وحمّل ملف SVG أو PDF المتجه فوراً.
              </div>
            </div>
          </div>
        </section>


        {/* ========================================================
            BOTTOM CALL TO ACTION BANNER
            ======================================================== */}
        <section
          style={{
            background: '#0F172A',
            borderRadius: '24px',
            padding: '44px 40px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '30px',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.25)',
            marginTop: '30px',
          }}
          className="cta-banner"
        >
          {/* Left Text */}
          <div style={{ maxWidth: '620px' }}>
            {/* Stars */}
            <div style={{ color: '#FBBF24', fontSize: '18px', marginBottom: '10px' }}>
              ★★★★★
            </div>
            <div style={{ fontSize: '14.5px', color: '#CBD5E1', fontStyle: 'italic', marginBottom: '20px' }}>
              "أصبحنا نوفر 15% إلى 20% من الهدر في الورق بعد استخدام برينتيرا... أداة ممتازة وسهلة جداً في الورشة والمطبعة."
              <span style={{ display: 'block', fontSize: '12.5px', color: '#94A3B8', marginTop: '4px', fontStyle: 'normal' }}>
                — أحمد، مدير إنتاج وتغليف
              </span>
            </div>

            <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px 0' }}>
              جاهز لتحسين استغلال الشيت؟
            </h3>
            <p style={{ fontSize: '14.5px', color: '#94A3B8', margin: '0 0 24px 0' }}>
              جرب مجاناً الآن واحصل على أفضل توزيع لقوالبك في ثوانٍ.
            </p>

            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 120, behavior: 'smooth' });
              }}
              style={{
                background: '#007BFF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 32px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(0, 123, 255, 0.4)',
              }}
            >
              <span>ابدأ مجاناً الآن</span>
              <ArrowLeft size={16} />
            </button>
          </div>

          {/* Right Miniature Graphic */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
            }}
            className="cta-mini-graphic"
          >
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: '90px',
                  height: '130px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src="/templates/preview/T0002.svg"
                  alt="Mini"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.7 }}
                />
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Global CSS Styles for Responsiveness */}
      <style>{`
        .dropzone-area:hover {
          background: #EFF6FF !important;
          border-color: #007BFF !important;
        }
        .btn-calculate:hover {
          background: #0066CC !important;
          transform: translateY(-2px);
        }
        @media (max-width: 900px) {
          .calc-grid-row {
            grid-template-columns: 1fr !important;
          }
          .results-grid-row {
            grid-template-columns: 1fr !important;
          }
          .why-cards-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .how-it-works-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .cta-banner {
            flex-direction: column !important;
            text-align: center;
          }
          .cta-mini-graphic {
            justify-content: center;
          }
        }
        @media (max-width: 600px) {
          .hero-diagram-box {
            flex-direction: column !important;
          }
          .preset-pills-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .why-cards-row {
            grid-template-columns: 1fr !important;
          }
          .how-it-works-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Footer */}
      <Footer />
    </div>
  );
}
