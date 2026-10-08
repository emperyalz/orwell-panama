'use client';

import Link from 'next/link';
import {useMemo, useRef, useState, useSyncExternalStore, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft, ArrowRight, Check, Download, Link2, Plus, Search, X} from 'lucide-react';
import {Portrait} from './Portrait';
import {COMPARISON_LIMIT, hasDifference, type ComparisonPerson} from '@/lib/comparison';
import {getPartyLogoPath} from '@/lib/constants';
import {platformIcon, PLATFORM_NAMES} from '@/lib/reference';

type PersonOption = {id: string; name: string; portrait?: string; party: string; role: string; province: string};
type Language = 'es' | 'en' | 'pt';
const subscribe = (notify: () => void) => {window.addEventListener('storage', notify); return () => window.removeEventListener('storage', notify);};
const readLanguage = (): Language => {const value = localStorage.getItem('orwell-panama-language'); return value === 'en' || value === 'pt' ? value : 'es';};
const officeKey = (role: string) => role.replace(/^Diputada$/, 'Diputado').replace(/^Alcaldesa$/, 'Alcalde').replace(/^Gobernadora$/, 'Gobernador').replace(/^Presidenta/, 'Presidente');
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const words = {
  posts: ['Publicaciones archivadas', 'Archived posts', 'Publicações arquivadas'], last: ['Última archivada', 'Latest archived', 'Última arquivada'], grouped: ['Archivo por persona y plataforma', 'Archive grouped by person and platform', 'Arquivo agrupado por pessoa e plataforma'],
  title: ['Comparar perfiles', 'Compare profiles', 'Comparar perfis'],
  intro: ['Personas, registros y diferencias. Reúne hasta ocho perfiles en una misma mesa.', 'People, records, and differences. Bring up to eight profiles to the same table.', 'Pessoas, registros e diferenças. Reúna até oito perfis na mesma mesa.'],
  back: ['Directorio', 'Directory', 'Diretório'], search: ['Busca un nombre, partido o provincia', 'Search a name, party, or province', 'Busque um nome, partido ou província'],
  add: ['Añadir perfiles', 'Add profiles', 'Adicionar perfis'], remove: ['Quitar', 'Remove', 'Remover'],
  all: ['Todos', 'All', 'Todos'], selected: ['perfiles seleccionados', 'profiles selected', 'perfis selecionados'],
  empty: ['Elige las personas que quieres comparar.', 'Choose the people you want to compare.', 'Escolha as pessoas que deseja comparar.'],
  emptyHelp: ['Busca arriba y añade perfiles. Puedes comparar cargos, partidos y registros disponibles.', 'Search above and add profiles. Compare offices, parties, and available records.', 'Busque acima e adicione perfis. Compare cargos, partidos e registros disponíveis.'],
  one: ['Añade otro perfil para ver las diferencias.', 'Add another profile to see the differences.', 'Adicione outro perfil para ver as diferenças.'],
  overview: ['Perfil', 'Profile', 'Perfil'], votes: ['Votaciones', 'Votes', 'Votações'], social: ['Redes', 'Social', 'Redes'], docs: ['Documentos', 'Documents', 'Documentos'],
  differences: ['Solo diferencias', 'Differences only', 'Somente diferenças'], share: ['Copiar enlace', 'Copy link', 'Copiar link'], copied: ['Enlace copiado', 'Link copied', 'Link copiado'], csv: ['Exportar CSV', 'Export CSV', 'Exportar CSV'],
  role: ['Cargo', 'Office', 'Cargo'], party: ['Partido', 'Party', 'Partido'], province: ['Provincia', 'Province', 'Província'], circuit: ['Circuito', 'District', 'Distrito'], birth: ['Nacimiento', 'Birth date', 'Nascimento'],
  accounts: ['Cuentas registradas', 'Recorded accounts', 'Contas registradas'], documents: ['Documentos enlazados', 'Linked documents', 'Documentos vinculados'],
  period: ['Período del archivo', 'Archive period', 'Período do arquivo'], total: ['Votos registrados', 'Recorded votes', 'Votos registrados'], favor: ['A favor', 'In favor', 'A favor'], against: ['En contra', 'Against', 'Contra'], abstain: ['Abstención', 'Abstention', 'Abstenção'],
  mandate: ['Tipo de registro', 'Record type', 'Tipo de registro'], principal: ['Principal', 'Principal member', 'Titular'], alternate: ['Suplente', 'Alternate member', 'Suplente'],
  missing: ['Sin datos', 'No data', 'Sem dados'], unavailable: ['Fuente no disponible', 'Source unavailable', 'Fonte indisponível'],
  coverage: ['Los períodos pueden variar. Los totales describen el archivo, no una clasificación de desempeño ni una tasa de asistencia.', 'Periods may differ. Totals describe the archive, not a performance ranking or an attendance rate.', 'Os períodos podem variar. Os totais descrevem o arquivo, não um ranking de desempenho nem uma taxa de presença.'],
  recent: ['Decisiones en los últimos registros', 'Decisions in the latest records', 'Decisões nos registros mais recentes'],
  recentNote: ['Cruce de las últimas 20 votaciones por persona. Una celda vacía no indica ausencia ni abstención. Abre el voto para ver su fuente.', 'Intersection of each person’s latest 20 voting records. A missing cell does not indicate absence or abstention. Open a vote to see its source.', 'Cruzamento das últimas 20 votações por pessoa. Uma célula sem dados não indica ausência nem abstenção. Abra o voto para ver sua fonte.'],
  noDifference: ['No hay diferencias documentadas en esta vista.', 'No documented differences in this view.', 'Não há diferenças documentadas nesta vista.'],
  noVotes: ['No hay decisiones compartidas en estos registros.', 'No shared decisions in these records.', 'Não há decisões compartilhadas nestes registros.'],
  socialNote: ['Cuentas del directorio. El número de cuentas no mide popularidad. Seguidores y alcance requieren una serie verificada.', 'Directory accounts. Account count does not measure popularity. Followers and reach require a verified series.', 'Contas do diretório. O número de contas não mede popularidade. Seguidores e alcance exigem uma série verificada.'],
  noAccounts: ['Sin cuenta registrada', 'No recorded account', 'Sem conta registrada'], probable: ['Identidad probable', 'Likely identity', 'Identidade provável'], confirmed: ['Identificada', 'Identified', 'Identificada'],
  source: ['Ver perfil y fuentes', 'View profile and sources', 'Ver perfil e fontes'], clear: ['Vaciar mesa', 'Clear table', 'Limpar mesa'], limit: ['Mesa completa. Quita un perfil para añadir otro.', 'Table full. Remove a profile to add another.', 'Mesa completa. Remova um perfil para adicionar outro.'],
  noResults: ['No encontramos perfiles con esos filtros.', 'No profiles match these filters.', 'Nenhum perfil corresponde a esses filtros.'],
  loading: ['Actualizando comparación…', 'Updating comparison…', 'Atualizando comparação…'],
  highlight: ['Las celdas resaltadas difieren del primer perfil. Los datos faltantes se muestran por separado.', 'Highlighted cells differ from the first profile. Missing records are shown separately.', 'As células destacadas diferem do primeiro perfil. Os dados ausentes são mostrados separadamente.'],
} satisfies Record<string, readonly string[]>;

export function ComparisonWorkspace({people, profiles}: {people: PersonOption[]; profiles: ComparisonPerson[]}) {
  const lang = useSyncExternalStore(subscribe, readLanguage, () => 'es' as Language);
  const t = (key: keyof typeof words) => words[key][lang === 'en' ? 1 : lang === 'pt' ? 2 : 0];
  const [search, setSearch] = useState(''); const [party, setParty] = useState(''); const [role, setRole] = useState('');
  const [tab, setTab] = useState<'overview' | 'votes' | 'social' | 'docs'>('overview');
  const [onlyDifferences, setOnlyDifferences] = useState(false); const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(profiles.length < 2);
  const [pending, startTransition] = useTransition(); const router = useRouter();
  const ids = profiles.map(p => p.id);
  const options = useMemo(() => people.filter(p => !ids.includes(p.id) && (!party || p.party === party) && (!role || p.role === role) && normalize(`${p.name} ${p.party} ${p.province}`).includes(normalize(search))).sort((a, b) => a.name.localeCompare(b.name)), [people, ids, party, role, search]);
  function navigate(next: string[]) {startTransition(() => router.push(`/comparar${next.length ? `?ids=${encodeURIComponent(next.join(','))}` : ''}`, {scroll: false}));}
  const date = (value: string | null | undefined) => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat(lang, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(value)) : t('missing');
  type Row = {label: string; values: (string | number | null)[]};
  const rows: Row[] = tab === 'votes' ? [
    {label: t('period'), values: profiles.map(p => p.archive ? `${p.archive.start} → ${p.archive.end}` : null)},
    {label: t('mandate'), values: profiles.map(p => p.alternate === null ? null : t(p.alternate ? 'alternate' : 'principal'))},
    {label: t('total'), values: profiles.map(p => p.votes)}, {label: t('favor'), values: profiles.map(p => p.inFavor)},
    {label: t('against'), values: profiles.map(p => p.against)}, {label: t('abstain'), values: profiles.map(p => p.abstentions)},
  ] : [
    {label: t('role'), values: profiles.map(p => officeKey(p.role))}, {label: t('party'), values: profiles.map(p => p.partyName)},
    {label: t('province'), values: profiles.map(p => p.province || null)}, {label: t('circuit'), values: profiles.map(p => p.circuit || null)},
    {label: t('birth'), values: profiles.map(p => p.birthDate ? date(p.birthDate) : null)},
    {label: t('accounts'), values: profiles.map(p => p.accounts.length)}, {label: t('documents'), values: profiles.map(p => p.documents.length)},
  ];
  const visibleRows = onlyDifferences ? rows.filter(row => hasDifference(row.values)) : rows;
  const questions = [...new Map(profiles.flatMap(p => p.recentVotes).map(v => [v.questionId, v])).values()]
    .filter(v => profiles.filter(p => p.recentVotes.some(vote => vote.questionId === v.questionId)).length >= 2)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const voteLabel = (value: string) => /^(a[_ ]?favor|si|sí|yes)$/i.test(value) ? t('favor') : /^(en[_ ]?contra|no)$/i.test(value) ? t('against') : /^abstenci[oó]n$/i.test(value) ? t('abstain') : value;
  async function share() {try {await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2200);} catch {setCopied(false);}}
  function exportCsv() {
    const exportRows = tab === 'social' ? [...new Set(profiles.flatMap(p => p.accounts.map(a => a.platform)))].flatMap(platform => [
      [PLATFORM_NAMES[platform] || platform, ...profiles.map(p => p.accounts.filter(a => a.platform === platform).map(a => `@${a.handle} | ${t('posts')}: ${a.posts} | ${t('last')}: ${a.latest ? date(new Date(a.latest).toISOString()) : t('missing')} | ${a.scope}`).join('; ') || t('missing'))],
    ]) : tab === 'docs' ? [...new Set(profiles.flatMap(p => p.documents.map(d => d.label)))].map(label => [label, ...profiles.map(p => p.documents.find(d => d.label === label)?.url || t('missing'))]) : rows.map(row => [row.label, ...row.values.map((value,index) => row.label === t('role') ? roleLabel(profiles[index].role) : value ?? t('missing'))]);
    const csvRows = [[t(tab), ...profiles.map(p => p.name)], ...exportRows];
    const safe = (value: string | number) => {let text = String(value); if (/^[=+@\-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`;};
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csvRows.map(row => row.map(safe).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'orwell-comparison.csv'; anchor.click(); URL.revokeObjectURL(url);
  }
  const roleLabel = (value: string) => lang === 'es' ? value : ({Diputado: ['Member of Parliament', 'Deputado'], Diputada: ['Member of Parliament', 'Deputada'], Alcalde: ['Mayor', 'Prefeito'], Alcaldesa: ['Mayor', 'Prefeita'], Gobernador: ['Governor', 'Governador'], Gobernadora: ['Governor', 'Governadora'], Presidente: ['President', 'Presidente'], 'Presidente de la República': ['President of the Republic', 'Presidente da República'], 'Presidente del partido': ['Party president', 'Presidente do partido'], 'Presidenta del partido': ['Party president', 'Presidente do partido'], 'Secretaria General': ['Secretary General', 'Secretária-Geral']} as Record<string, string[]>)[value]?.[lang === 'en' ? 0 : 1] || value;
  return <main className="reference-world compare-workspace" data-no-translate>
    <div className="compare-shell">
      <Link className="compare-back" href="/"><ArrowLeft size={16}/>{t('back')}</Link>
      <header className="compare-title"><div><h1>{t('title')}</h1><p>{t('intro')}</p></div><Link href="/metodologia">{lang === 'en' ? 'Sources & methodology' : lang === 'pt' ? 'Fontes e metodologia' : 'Fuentes y metodología'} <ArrowRight size={16}/></Link></header>
      {showPicker && <section className="compare-selection" aria-label={t('add')}>
        <div className="compare-find"><label><Search size={20}/><input placeholder={t('search')} aria-label={t('search')} value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label={t('clear')} onClick={() => setSearch('')}><X size={16}/></button>}</label>
          <select aria-label={t('party')} value={party} onChange={e => setParty(e.target.value)}><option value="">{t('party')}: {t('all')}</option>{[...new Set(people.map(p => p.party))].sort().map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label={t('role')} value={role} onChange={e => setRole(e.target.value)}><option value="">{t('role')}: {t('all')}</option>{[...new Set(people.map(p => p.role))].sort().map(value => <option key={value} value={value}>{roleLabel(value)}</option>)}</select>
        </div>
        <div className="compare-candidates">{options.slice(0, search ? 24 : 8).map(person => <button key={person.id} disabled={pending || ids.length >= COMPARISON_LIMIT} onClick={() => navigate([...ids, person.id])} aria-label={`${t('add')}: ${person.name}`}><Portrait src={person.portrait} name={person.name}/><span><strong>{person.name}</strong><small>{person.party} · {roleLabel(person.role)}</small></span><Plus size={17}/></button>)}{!options.length && <p>{t('noResults')}</p>}</div>
        {ids.length >= COMPARISON_LIMIT && <p role="status">{t('limit')}</p>}
      </section>}
      <div className="compare-controlbar"><span role="status">{pending ? t('loading') : `${profiles.length}/${COMPARISON_LIMIT} ${t('selected')}`}</span><div><button className="compare-add-button" aria-expanded={showPicker} onClick={() => setShowPicker(!showPicker)}><Plus size={16}/>{t('add')}</button><button onClick={share} disabled={!profiles.length}><Link2 size={16}/>{t(copied ? 'copied' : 'share')}</button><button onClick={exportCsv} disabled={!profiles.length}><Download size={16}/>{t('csv')}</button><button onClick={() => navigate([])} disabled={!profiles.length || pending}>{t('clear')}</button></div></div>
      {!profiles.length ? <div className="compare-empty"><h2>{t('empty')}</h2><p>{t('emptyHelp')}</p></div> : <>
        <div className="compare-viewbar"><nav aria-label={t('overview')}>{(['overview', 'votes', 'social', 'docs'] as const).map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(value)}</button>)}</nav>{(tab === 'overview' || tab === 'votes') && <label><input type="checkbox" checked={onlyDifferences} onChange={e => setOnlyDifferences(e.target.checked)}/>{t('differences')}</label>}</div>
        {profiles.length === 1 && <p className="compare-note">{t('one')}</p>}
        <div className="compare-scroll-controls"><span>{lang === 'en' ? 'Scroll across to compare every profile' : lang === 'pt' ? 'Role para comparar todos os perfis' : 'Desplázate para comparar todos los perfiles'}</span><div><button aria-label={lang === 'en' ? 'Previous profiles' : lang === 'pt' ? 'Perfis anteriores' : 'Perfiles anteriores'} onClick={() => scrollRef.current?.scrollBy({left: -440, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'})}><ArrowLeft size={17}/></button><button aria-label={lang === 'en' ? 'Next profiles' : lang === 'pt' ? 'Próximos perfis' : 'Perfiles siguientes'} onClick={() => scrollRef.current?.scrollBy({left: 440, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'})}><ArrowRight size={17}/></button></div></div>
        <div ref={scrollRef} className="compare-scroll" role="region" aria-label={t('title')} tabIndex={0} aria-busy={pending}>
          <table className="comparison-matrix"><thead><tr><th scope="col"><span>{lang === 'en' ? 'Panama' : 'Panamá'}</span><p>{t('highlight')}</p></th>{profiles.map((person, index) => <th scope="col" key={person.id}><div className="compare-person"><button className="compare-remove" disabled={pending} onClick={() => navigate(ids.filter(id => id !== person.id))} aria-label={`${t('remove')} ${person.name}`}><X size={17}/></button><Portrait src={person.portrait} name={person.name}/><Link href={`/politician/${person.id}`}><strong>{person.name}</strong></Link><span>{roleLabel(person.role)}</span><Link className="compare-party" href={`/partidos/${person.party.toLowerCase()}`}><img src={getPartyLogoPath(person.party)} alt={person.partyName}/>{person.party}</Link>{index > 0 && <button className="compare-baseline" disabled={pending} onClick={() => navigate([person.id, ...ids.filter(id => id !== person.id)])}>{lang === 'en' ? 'Use as reference' : lang === 'pt' ? 'Usar como referência' : 'Usar como referencia'}</button>}</div></th>)}</tr></thead>
            <tbody>{(tab === 'overview' || tab === 'votes') && visibleRows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={profiles[index].id} className={value === null ? 'compare-missing' : index > 0 && row.values[0] !== null && value !== row.values[0] ? 'compare-different' : ''}>{value === null ? profiles[index].unavailable && tab === 'votes' ? t('unavailable') : t('missing') : row.label === t('role') ? roleLabel(profiles[index].role) : typeof value === 'number' ? <strong className="compare-number">{new Intl.NumberFormat(lang).format(value)}</strong> : value}</td>)}</tr>)}
              {tab === 'social' && [...new Set(profiles.flatMap(p => p.accounts.map(a => a.platform)))].sort().map(platform => <tr key={platform}><th scope="row"><img className="compare-platform" src={platformIcon(platform)} alt={PLATFORM_NAMES[platform] || platform} title={PLATFORM_NAMES[platform] || platform}/></th>{profiles.map(person => <td key={person.id}>{person.accounts.filter(a => a.platform === platform).map(account => <a className="compare-account" key={account.profileUrl} href={account.profileUrl} target="_blank" rel="noreferrer">{account.avatar && <img className="compare-account-avatar" src={account.avatar} alt={account.handle}/>}<strong>@{account.handle.replace(/^@/, '')}</strong><span>{account.posts} {t('posts')}</span><time>{t('last')}: {account.latest ? date(new Date(account.latest).toISOString()) : t('missing')}</time>{account.scope === 'person-platform' && <small>{t('grouped')}</small>}<small>{t(account.verdict === 'CONFIRMED' ? 'confirmed' : 'probable')}</small></a>)}{!person.accounts.some(a => a.platform === platform) && <span className="compare-missing">{t('noAccounts')}</span>}</td>)}</tr>)}
              {tab === 'docs' && [...new Set(profiles.flatMap(p => p.documents.map(d => d.label)))].map(label => <tr key={label}><th scope="row">{({ 'Hoja de vida': ['Résumé', 'Currículo'], 'Propuesta política': ['Policy proposal', 'Proposta política'], 'Declaración de intereses': ['Declaration of interests', 'Declaração de interesses'], 'Declaración de patrimonio': ['Asset declaration', 'Declaração patrimonial']} as Record<string, string[]>)[label]?.[lang === 'en' ? 0 : 1] && lang !== 'es' ? ({ 'Hoja de vida': ['Résumé', 'Currículo'], 'Propuesta política': ['Policy proposal', 'Proposta política'], 'Declaración de intereses': ['Declaration of interests', 'Declaração de interesses'], 'Declaración de patrimonio': ['Asset declaration', 'Declaração patrimonial']} as Record<string, string[]>)[label][lang === 'en' ? 0 : 1] : label}</th>{profiles.map(person => <td key={person.id}>{person.documents.find(d => d.label === label) ? <a href={person.documents.find(d => d.label === label)!.url} target="_blank" rel="noreferrer"><Check size={16}/> {lang === 'en' ? 'Open document' : lang === 'pt' ? 'Abrir documento' : 'Abrir documento'}</a> : <span className="compare-missing">{t('missing')}</span>}</td>)}</tr>)}
              {tab === 'votes' && questions.filter(question => !onlyDifferences || hasDifference(profiles.map(p => p.recentVotes.find(v => v.questionId === question.questionId)?.vote ?? null))).map(question => <tr key={question.questionId}><th scope="row"><time>{date(question.date)}</time><span>{question.questionText}</span></th>{profiles.map(person => {const vote = person.recentVotes.find(v => v.questionId === question.questionId); const first = profiles[0].recentVotes.find(v => v.questionId === question.questionId); return <td key={person.id} className={vote && first && vote.vote !== first.vote ? 'compare-different' : ''}>{vote ? <Link href={`/politician/${person.id}/voto/${question.questionId}`}>{voteLabel(vote.vote)} <ArrowRight size={13}/></Link> : <span className="compare-missing">{t('missing')}</span>}</td>;})}</tr>)}
            </tbody>
          </table>
        </div>
        {(tab === 'overview' || tab === 'votes') && !visibleRows.length && <p className="compare-note">{t('noDifference')}</p>}
        {tab === 'votes' && <div className="compare-evidence"><h2>{t('recent')}</h2><p>{t('recentNote')}</p>{!questions.length && <p>{t('noVotes')}</p>}</div>}
        {tab === 'social' && <p className="compare-note">{t('socialNote')}</p>}
        {tab === 'docs' && !profiles.some(p => p.documents.length) && <p className="compare-note">{t('missing')}</p>}
        <footer className="compare-evidence"><p>{t('coverage')}</p><div>{profiles.map(person => <Link key={person.id} href={`/politician/${person.id}`}>{person.name}: {t('source')} <ArrowRight size={14}/></Link>)}</div></footer>
      </>}
    </div>
  </main>;
}
