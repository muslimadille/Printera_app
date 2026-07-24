import { useState } from 'react';
import { Link } from 'react-router-dom';

export interface Template {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  desc: string;
  tags: string[];
  pro: boolean;
  svg: string;
}

interface TemplateCardProps {
  template: Template;
  variant?: 'minimal' | 'full';
}

// Fallback vector dieline SVG matching the screenshot (Red cut lines & Green crease lines)
function FallbackDielineSvg() {
  return (
    <svg viewBox="0 0 160 170" style={{ width: '100%', height: '100%', maxHeight: '180px' }}>
      <path
        d="M 45 15 L 115 15 L 115 38 L 142 38 L 142 135 L 115 135 L 115 158 L 45 158 L 45 135 L 18 135 L 18 38 L 45 38 Z"
        fill="#FFFFFF"
        stroke="#EF4444"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line x1="45" y1="38" x2="115" y2="38" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="45" y1="135" x2="115" y2="135" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="45" y1="38" x2="45" y2="135" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="115" y1="38" x2="115" y2="135" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="68" y1="38" x2="68" y2="135" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="92" y1="38" x2="92" y2="135" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

export default function TemplateCard({ template, variant = 'minimal' }: TemplateCardProps) {
  const getSvgPath = (id: string, dbSvg: string) => {
    const formattedId = id.toUpperCase();
    if (formattedId === 'D001-H') return '/templates/preview/D001-H.svg';
    if (formattedId === 'T00012') return '/templates/preview/T00012.svg';
    if (formattedId === 'T0002') return '/templates/preview/T0002.svg';
    if (formattedId === 'T0005') return '/templates/preview/T0005.svg';
    if (formattedId === 'T0006') return '/templates/preview/T0006.svg';
    return dbSvg && dbSvg.startsWith('public/') ? dbSvg.replace('public/', '/') : dbSvg;
  };

  const svgPath = getSvgPath(template.id, template.svg);

  const [isHovered, setIsHovered] = useState(false);
  const [imgRealSrc, setImgRealSrc] = useState(`/templates/real/${template.id}.png`);
  const [img3dSrc, setImg3dSrc] = useState(`/templates/3d/${template.id}.png`);
  const [useFallbackSvg, setUseFallbackSvg] = useState(false);

  return (
    <Link 
      to={`/template/${template.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}
    >
      {/* Outer Rounded Container Box (Matching Screenshot Image) */}
      <div 
        className="tc-card-box" 
        style={{ 
          width: '100%',
          aspectRatio: '1 / 1', 
          background: '#ffffff', 
          border: '1px solid #b0b0b0', 
          borderRadius: '20px', 
          overflow: 'hidden', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          padding: '24px',
          boxSizing: 'border-box',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {useFallbackSvg ? (
          <FallbackDielineSvg />
        ) : (
          <>
            {/* Main Image (2D Dieline) */}
            <div style={{ opacity: isHovered ? 0 : 1, transition: 'all 0.3s ease', position: 'absolute', inset: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={imgRealSrc}
                onError={() => {
                  if (imgRealSrc !== svgPath && svgPath) {
                    setImgRealSrc(svgPath);
                  } else {
                    setUseFallbackSvg(true);
                  }
                }}
                alt={template.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.4s ease' }}
                className="main-img"
              />
            </div>

            {/* Hover Image (3D Model) */}
            <div style={{ opacity: isHovered ? 1 : 0, transition: 'all 0.3s ease', position: 'absolute', inset: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={img3dSrc}
                onError={() => setImg3dSrc('/brand/printera-logo-trans.png')}
                alt={`معاينة ثلاثية الأبعاد — ${template.title}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.4s ease' }}
                className="hover-img"
              />
            </div>
          </>
        )}
      </div>

      {/* Title placed OUTSIDE and BELOW the rounded container box */}
      <span 
        style={{ 
          fontSize: '15px', 
          fontWeight: 600, 
          color: '#334155', 
          marginTop: '14px', 
          textAlign: 'center',
          lineHeight: '1.4' 
        }}
      >
        {template.title || 'علبة قابلة للطي'}
      </span>

      <style>{`
        .tc-card-box:hover {
          transform: translateY(-4px);
          border-color: #007BFF !important;
          box-shadow: 0 12px 28px rgba(0, 123, 255, 0.1) !important;
        }
        .tc-card-box:hover .main-img, .tc-card-box:hover .hover-img {
          transform: scale(1.05);
        }
      `}</style>
    </Link>
  );
}

