import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ClockButton } from '@/components/ClockButton';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/lib/api';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export default function StaffPonto() {
  const [docModal, setDocModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];

    if (file.size && file.size > MAX_SIZE) {
      Alert.alert('Arquivo muito grande', 'O documento deve ter no máximo 2MB.');
      return;
    }

    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await api.post('/api/staff-documents', {
        type: 'atestado',
        filename: file.name,
        mime_type: file.mimeType ?? 'application/pdf',
        file_data: base64,
        file_size: file.size ?? base64.length,
        description: 'Justificativa de falta enviada pelo app',
      });
      Alert.alert('Documento enviado!', 'Seu atestado foi enviado para análise da gestão.');
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
        className="flex-row justify-center items-center gap-2 border border-border rounded-xl py-3 mt-2"
      >
        <Ionicons name="attach" size={18} color="#6B7280" />
        <Text className="text-ink-muted text-sm">Enviar atestado / justificativa de falta</Text>
      </TouchableOpacity>

      <Modal visible={docModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-canvas p-6 items-center justify-center">
          <View className="w-16 h-16 rounded-2xl bg-primary-soft items-center justify-center mb-4">
            <Ionicons name="document-attach-outline" size={32} color="#1A56DB" />
          </View>
          <Text className="text-ink text-xl font-bold mb-2">Enviar documento</Text>
          <Text className="text-ink-muted text-sm text-center mb-6">
            Selecione um PDF ou imagem (máx. 2MB) do seu atestado médico ou outro documento justificativo de falta.
          </Text>
          <TouchableOpacity onPress={pickAndUpload} disabled={uploading} className={`bg-primary rounded-xl py-4 px-8 items-center mb-4 w-full ${uploading ? 'opacity-60' : ''}`}>
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
