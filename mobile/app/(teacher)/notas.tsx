import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

interface SchoolClass { id: string; name: string; subjects?: { subject_id: string; subject_name?: string }[] }
interface Student { id: string; name: string }
interface Grade { student_id: string; grade?: number | null; grade_2?: number | null; grade_3?: number | null; grade_4?: number | null }

export default function TeacherNotas() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<{ id: string; name: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bimestre, setBimestre] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    api.get<{ data: SchoolClass[] }>('/api/classes/mine')
      .then(r => setClasses(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function selectSubject(cls: SchoolClass, subj: { id: string; name?: string }) {
    setSelectedClass(cls);
    setSelectedSubject({ id: subj.id, name: subj.name ?? subj.id });
    setLoading(true);
    try {
      const [st, gr] = await Promise.all([
        api.get<{ data: Student[] }>(`/api/students?class_id=${cls.id}`),
        api.get<{ data: Grade[] }>(`/api/grades?class_id=${cls.id}&subject_id=${subj.id}`),
      ]);
      setStudents(st.data ?? []);
      const gMap: Record<string, string> = {};
      (gr.data ?? []).forEach(g => {
        const key = `grade_${bimestre}` as keyof Grade;
        const v = g[key];
        gMap[g.student_id] = v != null ? String(v) : '';
      });
      setGrades(gMap);
    } catch {}
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const key = `grade_${bimestre}`;
      await api.post('/api/grades/bulk', {
        class_id: selectedClass!.id,
        subject_id: selectedSubject!.id,
        bimestre,
        records: students.map(s => ({
          student_id: s.id,
          [key]: grades[s.id] ? parseFloat(grades[s.id]) : null,
        })),
      });
      Alert.alert('Notas salvas!');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !selectedClass) return (
    <Screen title="Lançar Notas">
      <ActivityIndicator color="#1A56DB" size="large" className="mt-8" />
    </Screen>
  );

  if (!selectedClass) return (
    <Screen title="Lançar Notas">
      {classes.map(c => (
        <Card key={c.id}>
          <Text className="text-ink font-bold mb-2">{c.name}</Text>
          {(c.subjects ?? []).map(s => (
            <TouchableOpacity key={s.subject_id} onPress={() => selectSubject(c, { id: s.subject_id, name: s.subject_name })}>
              <View className="bg-primary-soft rounded-lg px-3 py-2 mb-1">
                <Text className="text-primary font-medium">{s.subject_name ?? s.subject_id}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      ))}
      {classes.length === 0 && <Text className="text-ink-muted">Nenhuma turma.</Text>}
    </Screen>
  );

  return (
    <Screen title={`Notas — ${selectedClass.name}`}>
      <TouchableOpacity onPress={() => { setSelectedClass(null); setSelectedSubject(null); }} className="mb-3">
        <Text className="text-primary text-sm">← Voltar</Text>
      </TouchableOpacity>
      <Text className="text-ink font-semibold mb-3">{selectedSubject?.name}</Text>

      {/* Bimestre selector */}
      <View className="flex-row gap-2 mb-4">
        {([1,2,3,4] as const).map(b => (
          <TouchableOpacity
            key={b}
            onPress={() => setBimestre(b)}
            className={`flex-1 py-2 rounded-lg items-center border ${bimestre === b ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
          >
            <Text className={bimestre === b ? 'text-white font-bold' : 'text-ink-muted'}>{b}º Bim</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <ActivityIndicator color="#1A56DB" />
        : students.map(s => (
          <View key={s.id} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2 mb-2">
            <Text className="flex-1 text-ink">{s.name}</Text>
            <TextInput
              className="w-16 text-center border border-border rounded-lg py-1 text-ink"
              placeholder="—"
              keyboardType="decimal-pad"
              value={grades[s.id] ?? ''}
              onChangeText={v => setGrades(prev => ({ ...prev, [s.id]: v }))}
            />
          </View>
        ))
      }

      {students.length > 0 && (
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          className={`mt-4 bg-primary rounded-xl py-4 items-center ${saving ? 'opacity-60' : ''}`}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Salvar Notas</Text>}
        </TouchableOpacity>
      )}
    </Screen>
  );
}
