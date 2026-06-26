import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarDays, Plus, Trash2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { listEvents, createEvent, removeEvent, EVENT_TYPE_LABELS, type CalendarEvent, type EventType } from '@/services/calendar';

const TYPE_TONE: Record<EventType, 'primary' | 'success' | 'warning' | 'danger'> = {
  holiday: 'danger',
  exam: 'warning',
  meeting: 'primary',
  event: 'success',
  recess: 'primary',
};

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ title: string; date_start: string; event_type: EventType; description: string }>();

  useEffect(() => { load(); }, [year]);

  async function load() {
    setLoading(true);
    try { setEvents(await listEvents(year)); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onCreate(data: { title: string; date_start: string; event_type: EventType; description: string }) {
    await createEvent(data);
    await load();
    reset();
    setOpen(false);
  }

  async function onRemove(id: string) {
    await removeEvent(id);
    await load();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Ano Letivo / Calendário"
        subtitle="Gerencie feriados, provas, reuniões e eventos do calendário escolar."
        actions={
          <div className="flex items-center gap-2">
            <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} /> Novo evento
            </button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhum evento cadastrado"
            description="Adicione feriados, provas e reuniões ao calendário."
            action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Novo evento</button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{new Date(ev.date_start).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 font-medium text-ink">{ev.title}</td>
                  <td className="px-4 py-3"><StatusBadge tone={TYPE_TONE[ev.event_type]}>{EVENT_TYPE_LABELS[ev.event_type]}</StatusBadge></td>
                  <td className="px-4 py-3 text-ink-muted">{ev.description || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onRemove(ev.id)} title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={open}
        title="Novo evento"
        onClose={() => { reset(); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="calendar-form" type="submit">Criar evento</button>
          </>
        }
      >
        <form id="calendar-form" className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="label">Título *</label>
            <input className="input" placeholder="Ex.: Feriado Nacional" {...register('title', { required: 'Informe o título' })} />
            {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Data *</label>
              <input type="date" className="input" {...register('date_start', { required: 'Informe a data' })} />
              {errors.date_start && <p className="mt-1 text-xs text-danger">{errors.date_start.message}</p>}
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="input" {...register('event_type', { required: 'Selecione o tipo' })}>
                {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" placeholder="Detalhes do evento (opcional)" {...register('description')} />
          </div>
        </form>
      </Modal>
    </>
  );
}
