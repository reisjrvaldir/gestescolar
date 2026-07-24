import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

interface SchoolClass { id: string; name: string }
interface Student { id: string; name: string }

export default function TeacherChamada() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<{ data: SchoolClass[] }>('/api/classes/mine')
      .then(r => setClasses(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    api.get<{ data: Student[] }>(`/api/students?class_id=${selectedClass}`)
      .then(r => {
        const st = r.data ?? [];
        setStudents(st);
        const init: Record<string, boolean> = {};
        st.forEach(s => init[s.id] = true);
        setAttendance(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedClass]);

  function toggle(id: string) {
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.post('/api/attendance/bulk', {
        class_id: selectedClass,
        date: today,
        records: students.map(s => ({ student_id: s.id, present: attendance[s.id] ?? true })),
      });
      Alert.alert('Chamada salva!', 'A presença foi registrada com sucesso.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a chamada');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !selectedClass) return (
    <Screen title="Chamada">
      <ActivityIndicator color="#1A56DB" size="large" className="mt-8" />
    </Screen>
  );

  if (!selectedClass) return (
    <Screen title="Chamada">
      <Text className="text-ink-muted text-sm mb-3">Selecione a turma:</Text>
      {classes.map(c => (
        <TouchableOpacity key={c.id} onPress={() => setSelectedClass(c.id)}>
          <Card>
            <Text className="text-ink font-semibold">{c.name}</Text>
          </Card>
        </TouchableOpacity>
      ))}
      {classes.length === 0 && <Text className="text-ink-muted text-sm">Nenhuma turma encontrada.</Text>}
    </Screen>
  );

  return (
    <Screen title="Chamada">
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={() => setSelectedClass(null)}>
          <Text className="text-primary text-sm">← Turmas</Text>
        </TouchableOpacity>
        <Text className="text-ink-muted text-xs">{today}</Text>
      </View>

      {loading
        ? <ActivityIndicator color="#1A56DB" size="large" />
        : students.map(s => (
          <TouchableOpacity key={s.id} onPress={() => toggle(s.id)}>
            <View className={`flex-row items-center p-3 rounded-xl mb-2 border ${
              attendance[s.id] !== false ? 'bg-success-soft border-success/30' : 'bg-danger-soft border-danger/30'
            }`}>
              <Text className="text-xl mr-3">{attendance[s.id] !== false ? '✅' : '❌'}</Text>
              <Text className="text-ink font-medium flex-1">{s.name}</Text>
              <Text className={`text-xs font-semibold ${attendance[s.id] !== false ? 'text-success' : 'text-danger'}`}>
                {attendance[s.id] !== false ? 'Presente' : 'Falta'}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      }

      {students.length > 0 && (
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          className={`mt-4 bg-primary rounded-xl py-4 items-center ${saving ? 'opacity-60' : ''}`}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold">Salvar Chamada</Text>
          }
        </TouchableOpacity>
      )}
    </Screen>
  );
}
