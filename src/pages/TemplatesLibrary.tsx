import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TemplateCard from '@/components/TemplateCard';

import { supabase } from '@/integrations/supabase/client';

// Templates are now fetched purely from the backend

export const HERO_STATS = [
  { icon: 'ph ph-check-circle', label: 'دقة هندسية بكسل بكسل' },
  { icon: 'ph ph-scissors', label: 'جاهزة للطباعة والقص' },
  { icon: 'ph ph-users', label: 'موثوقة لدى المصممين' },
  { icon: 'ph ph-shield-check', label: 'هندسة موثقة' },
];

export default function TemplatesLibrary() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [activeCat, setActiveCat] = useState(() => searchParams.get('cat') || 'all');
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([{ id: 'all', label: 'الكل' }]);
  const [isLoading, setIsLoading] = useState(true);

  // Re-sync when navigated here again with different search-bar/category params
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setActiveCat(searchParams.get('cat') || 'all');
  }, [searchParams]);

  // Fetch data from backend
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [catRes, tempRes] = await Promise.all([
          supabase.from('app_categories').select('*'),
          supabase.from('app_templates').select('*')
        ]);
        
        if (catRes.data && catRes.data.length > 0) {
          setCategories([{ id: 'all', label: 'الكل' }, ...catRes.data]);
        }
        if (tempRes.data && tempRes.data.length > 0) {
          setTemplates(tempRes.data);
        }
      } catch (err) {
        console.error("Failed to fetch templates/categories from backend, using static fallback", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const q = query.trim().toLowerCase();
  const filteredTemplates = templates.filter((t) => {
    const matchesCat = activeCat === 'all' || t.category === activeCat;
    const matchesQuery = !q || t.title.toLowerCase().includes(q) || (t.tags && t.tags.some((tg: string) => tg.toLowerCase().includes(q)));
    return matchesCat && matchesQuery;
  });

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)' }}>
      <Header active="library" />

      <section style={{ padding: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ marginBottom: '6px', color: 'var(--brand-navy)', fontSize: '38px' }}>مكتبة القوالب</h1>
            <div style={{ fontSize: '13px', letterSpacing: '0.06em', color: 'var(--brand-muted-2)', fontWeight: 700 }}>
              {filteredTemplates.length} قالب قياسي
            </div>
          </div>
          <div style={{ width: '320px', maxWidth: '100%', position: 'relative' }}>
            <i className="ph ph-magnifying-glass" style={{ position: 'absolute', insetInlineStart: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: 'var(--brand-muted-2)' }}></i>
            <input
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', paddingInlineStart: '34px', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-md)', background: '#ffffff', fontSize: '14px', color: 'var(--brand-navy)', outline: 'none', boxShadow: '0 2px 8px rgba(15,29,45,0.04)' }}
              type="text"
              placeholder="ابحث في القوالب..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--brand-muted-2)', fontWeight: 700, paddingInlineEnd: 'var(--space-3)', borderInlineEnd: '1px solid var(--brand-border)', marginInlineEnd: '6px' }}>
            <i className="ph ph-funnel"></i> تصفية
          </span>
          {categories.map((cat) => {
            const active = cat.id === activeCat;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className="cat-pill"
                style={{
                  padding: '8px 18px',
                  borderRadius: '999px',
                  fontSize: '14px',
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  background: active ? 'var(--brand-navy)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--brand-muted)',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-6)' }}>
          {filteredTemplates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: 'var(--brand-muted-2)' }}>
            <i className="ph ph-cube-transparent" style={{ fontSize: '36px', display: 'block', marginBottom: 'var(--space-2)' }}></i>
            لا توجد قوالب مطابقة لبحثك
          </div>
        )}
      </section>

      <Footer variant="rich" thirdColumn="categories" />
    </div>
  );
}
