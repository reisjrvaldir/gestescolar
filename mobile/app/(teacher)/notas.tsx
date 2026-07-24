import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

const PERIODS = ['1ª Unidade', '2ª Unidade', '3ª Unidade', '4ª Unidade'];

interface Subject { subject_id: string; subject_name?: string }
interface SchoolClass { id: string; name: string; subjects?: Subject[] }
interface GradeRow { student_id: string; student_name: string; av1?: number | null; av2?: number | null; final_grade?: number | null }

export default function TeacherNotas() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [cls, setCls] = useState<SchoolClass | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [av1, setAv1] = useState<Record<string, string>>({});
  const [av2, setAv2] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: SchoolClass[] }>('/api/classes/mine')
      .then(r => setClasses(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadGrades(c: SchoolClass, subj: string, per: string) {
    setLoading(true);
    try {
      const r = await api.get<{ data: GradeRow[] }>(
        `/api/grades?class_id=${c.id}&subject=${encodeURIComponent(subj)}&period=${encodeURIComponent(per)}`,
      );
      const data = r.data ?? [];
      setRows(data);
      const a1: Record<string, string> = {}, a2: Record<string, string> = {};
      data.forEach(g => {
        a1[g.student_id] = g.av1 != null ? String(g.av1) : '';
        a2[g.student_id] = g.av2 != null ? String(g.av2) : '';
      });
      setAv1(a1); setAv2(a2);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar as notas');
    }
    setLoading(false);
  }

  function pickSubject(c: SchoolClass, subj: string) {
    setCls(c); setSubject(subj);
    loadGrades(c, subj, period);
  }

  function changePeriod(p: string) {
    setPeriod(p);
    if (cls && subject) loadGrades(cls, subject, p);
  }

  async function save() {
    if (!cls || !subject) return;
    setSaving(true);
    try {
      await api.post('/api/grades/batch', {
        class_id: cls.id,
        subject,
        period,
        entries: rows.map(r => ({
          student_id: r.student_id,
          av1: av1[r.student_id] ? parseFloat(av1[r.student_id]) : undefined,
          av2: av2[r.student_id] ? parseFloat(av2[r.student_id]) : undefined,
        })),
      });
      Alert.alert('Notas salvas!', `${subject} — ${period}`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !cls) return (
    <Screen title="Lançar Notas"><ActivityIndicator color="#1A56DB" className="mt-8" /></Screen>
  );

  if (!cls || !subject) return (
    <Screen title="Lançar Notas">
      {classes.map(c => (
        <Card key={c.id}>
          <Text className="text-ink font-bold mb-2">{c.name}</Text>
          {(c.subjects ?? []).length === 0 ? (
            <Text className="text-ink-muted text-sm">Nenhuma matéria vinculada.</Text>
          ) : (
            (c.subjects ?? []).map(s => (
              <TouchableOpacity key={s.subject_id} onPress={() => pickSubject(c, s.subject_name ?? '')}>
                <View className="bg-primary-soft rounded-lg px-3 py-2 mb-1">
                  <Text className="text-primary font-medium">{s.subject_name ?? s.subject_id}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Card>
      ))}
      {classes.length === 0 && <Text className="text-ink-muted text-center mt-8">Nenhuma turma.</Text>}
    </Screen>
  );

  return (
    <Screen title={cls.name}>
      <TouchableOpacity onPress={() => { setCls(null); setSubject(null); }} className="mb-3">
        <Text className="text-primary text-sm">← Voltar</Text>
      </TouchableOpacity>
      <Text className="text-ink font-semibold mb-3">{subject}</Text>

      <View className="flex-row gap-2 mb-4">
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            onPress={() => changePeriod(p)}
            className={`flex-1 py-2 rounded-lg items-center border ${period === p ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
          >
            <Text className={period === p ? 'text-white font-bold text-xs' : 'text-ink-muted text-xs'}>{p.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="flex-row px-3 mb-1">
        <Text className="flex-1 text-ink-subtle text-xs font-semibold uppercase">Aluno</Text>
        <Text className="w-16 text-center text-ink-subtle text-xs font-semibold uppercase">AV1</Text>
        <Text className="w-16 text-center text-ink-subtle text-xs font-semibold uppercase">AV2</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#1A56DB" className="mt-4" />
      ) : rows.length === 0 ? (
        <Text className="text-ink-muted text-center mt-6">Nenhum aluno nesta turma.</Text>
      ) : (
        rows.map(r => (
          <View key={r.student_id} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2 mb-1.5">
            <Text className="flex-1 text-ink text-sm" numberOfLines={1}>{r.student_name}</Text>
            <TextInput
              className="w-16 text-center border border-border rounded-lg py-1 text-ink mx-0.5"
              placeholder="—" keyboardType="decimal-pad"
              value={av1[r.student_id] ?? ''}
              onChangeText={v => setAv1(p => ({ ...p, [r.student_id]: v }))}
            />
            <TextInput
              className="w-16 text-center border border-border rounded-lg py-1 text-ink mx-0.5"
              placeholder="—" keyboardType="decimal-pad"
              value={av2[r.student_id] ?? ''}
              onChangeText={v => setAv2(p => ({ ...p, [r.student_id]: v }))}
            />
          </View>
        ))
      )}

      {rows.length > 0 && (
        <TouchableOpacity onPress={save} disabled={saving} className={`mt-4 bg-primary rounded-xl py-4 items-center ${saving ? 'opacity-60' : ''}`}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Salvar Notas</Text>}
        </TouchableOpacity>
      )}
    </Screen>
  );
}
