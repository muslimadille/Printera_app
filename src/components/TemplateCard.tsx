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

  return (
    <div className="tc-card" style={{ background: '#ffffff', border: '1px solid #e6dccb', borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '4/3', background: '#f4ede1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
        {template.pro && (
          <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#c1461f', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', letterSpacing: '0.02em', zIndex: 10 }}>PRO</span>
        )}
        <img 
          src={svgPath} 
          alt={template.title} 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
        />
      </div>
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: '#a9622f', textTransform: 'uppercase' }}>
          {template.categoryLabel}
        </span>
        <h4 style={{ margin: 0, minHeight: '1.2em', fontSize: '17px', fontWeight: 700, color: '#2b2013' }}>
          {template.title}
        </h4>
        <p style={{ margin: 0, minHeight: '2.6em', fontSize: '13.5px', color: '#8a7d6d', lineHeight: '1.5', flex: 1 }}>
          {template.desc}
        </p>
        <div style={{ height: '1px', background: '#e8ded0', margin: '6px 0' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {template.tags.map((tag, idx) => (
              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#efe4d3', color: '#6b5d4a', fontSize: '11px', padding: '3px 9px', borderRadius: '6px' }}>
                <i className="ph ph-tag" style={{ fontSize: '10px' }}></i>
                {tag}
              </span>
            ))}
          </div>
          <Link to={`/template/${template.id}`} className="tc-design-link" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#2b2013', textDecoration: 'none' }}>
            تصميم <i className="ph ph-arrow-left"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
