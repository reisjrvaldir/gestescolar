import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ClockButton } from '@/components/ClockButton';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '@/lib/api';

export default function StaffPonto() {
  const [docModal, setDocModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as any);
      form.append('type', 'absence_justification');
      await fetch('https://backend-pi-snowy-15.vercel.app/api/documents', {
        method: 'POST',
        body: form,
      });
      Alert.alert('Documento enviado!', 'Seu atestado/documento foi enviado para análise.');
      setDocModal(false);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível enviar o documento');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen title="Ponto">
      <ClockButton />

      <TouchableOpacity
        onPress={() => setDocModal(true)}
        className="border border-border rounded-xl py-3 items-center mt-2"
      >
        <Text className="text-ink-muted text-sm">📎 Enviar atestado / doc. justificativa</Text>
      </TouchableOpacity>

      <Modal visible={docModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-canvas p-6 items-center justify-center">
          <Text className="text-ink text-xl font-bold mb-2">Enviar documento</Text>
          <Text className="text-ink-muted text-sm text-center mb-6">
            Selecione um PDF ou imagem do seu atestado médico ou outro documento justificativo de falta.
          </Text>
          <TouchableOpacity onPress={pickAndUpload} disabled={uploading} className={`bg-primary rounded-xl py-4 px-8 items-center mb-4 ${uploading ? 'opacity-60' : ''}`}>
            {uploading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Selecionar arquivo</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDocModal(false)}>
            <Text className="text-ink-muted">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Screen>
  );
}
