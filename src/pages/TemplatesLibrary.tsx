import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TemplateCard from '@/components/TemplateCard';
import { supabase } from '@/integrations/supabase/client';
import { useAppTemplates } from '@/hooks/useAppTemplates';

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
  const { templates, isLoading } = useAppTemplates();
  const [categories, setCategories] = useState<any[]>([{ id: 'all', label: 'الكل' }]);

  // Re-sync when navigated here again with different search-bar/category params
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setActiveCat(searchParams.get('cat') || 'all');
  }, [searchParams]);

  // Fetch categories from backend
  useEffect(() => {
    async function fetchCategories() {
      try {
        const catRes = await supabase.from('app_categories').select('*');
        if (catRes.data && catRes.data.length > 0) {
          setCategories([{ id: 'all', label: 'الكل' }, ...catRes.data]);
        }
      } catch (err) {
        console.error("Failed to fetch categories from backend", err);
      }
    }
    fetchCategories();
  }, []);

  const q = query.trim().toLowerCase();
  const filteredTemplates = templates.filter((t) => {
    if (t.status === 'inactive') return false;
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
            <h1 style={{ marginBottom: '6px', color: 'var(--brand-navy)', fontSize: '38px' }}>القوالب</h1>
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

      <Footer />
    </div>
  );
}
