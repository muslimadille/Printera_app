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
}

export default function TemplateCard({ template }: TemplateCardProps) {
  // Convert public/templates/preview/... to /templates/preview/... for Vite root serving
  const svgPath = template.svg.startsWith('public/')
    ? template.svg.replace('public/', '/')
    : template.svg;

  const [isHovered, setIsHovered] = useState(false);
  const [imgRealSrc, setImgRealSrc] = useState(`/templates/real/${template.id}.png`);
  const [img3dSrc, setImg3dSrc] = useState(`/templates/3d/${template.id}.png`);

  return (
    <div 
      className="tc-card hover:shadow-xl transition-shadow duration-300" 
      style={{ background: '#ffffff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="tc-thumb group cursor-pointer" style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--brand-tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
        {template.pro && (
          <span style={{ position: 'absolute', top: '12px', insetInlineStart: '12px', background: 'var(--brand-pro)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', letterSpacing: '0.02em', zIndex: 10 }}>PRO</span>
        )}
        
        {/* Main Image - Shows when NOT hovered */}
        <div style={{ opacity: isHovered ? 0 : 1, transition: 'opacity 0.3s ease', position: 'absolute', inset: 'var(--space-4)', width: 'calc(100% - var(--space-4) * 2)', height: 'calc(100% - var(--space-4) * 2)' }}>
          <img
            src={imgRealSrc}
            onError={() => setImgRealSrc(svgPath)} // Fallback to SVG dieline if real image doesn't exist
            alt={template.title}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Hover Image (3D Model or Logo) - Shows when hovered */}
        <div style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s ease', position: 'absolute', inset: 'var(--space-4)', width: 'calc(100% - var(--space-4) * 2)', height: 'calc(100% - var(--space-4) * 2)' }}>
          <img
            src={img3dSrc}
            onError={() => setImg3dSrc('/brand/printera-logo-trans.png')}
            alt={`معاينة ثلاثية الأبعاد — ${template.title}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--brand-gold)', textTransform: 'uppercase' }}>
          {template.categoryLabel}
        </span>
        <h4 style={{ margin: 0, minHeight: '1.2em', fontSize: '17px', fontWeight: 700, color: 'var(--brand-navy)' }}>
          {template.title}
        </h4>
        <p style={{ margin: 0, minHeight: '2.6em', fontSize: '13.5px', color: 'var(--brand-muted-2)', lineHeight: '1.5', flex: 1 }}>
          {template.desc}
        </p>
        <div style={{ height: '1px', background: 'var(--brand-border)', margin: '6px 0' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {template.tags.map((tag, idx) => (
              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--brand-tag-bg)', color: 'var(--brand-muted)', fontSize: '11px', padding: '3px 9px', borderRadius: '6px' }}>
                <i className="ph ph-tag" style={{ fontSize: '10px' }}></i>
                {tag}
              </span>
            ))}
          </div>
          <Link to={`/template/${template.id}`} className="tc-design-link" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: 'var(--brand-navy)', textDecoration: 'none' }}>
            تصميم <i className="ph ph-arrow-left"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
