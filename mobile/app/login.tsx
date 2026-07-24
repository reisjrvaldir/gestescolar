import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header azul */}
        <View className="bg-primary px-6 pt-16 pb-10 items-center">
          <Text className="text-white text-3xl font-bold tracking-tight">GestEscolar</Text>
          <Text className="text-white/70 text-sm mt-1">Gestão escolar inteligente</Text>
        </View>

        {/* Form */}
        <View className="flex-1 px-6 pt-8 pb-6">
          <Text className="text-ink text-xl font-bold mb-1">Entrar</Text>
          <Text className="text-ink-muted text-sm mb-6">Use seu e-mail ou matrícula</Text>

          {error && (
            <View className="bg-danger-soft border border-danger/20 rounded-xl px-3 py-2 mb-4">
              <Text className="text-danger text-sm">{error}</Text>
            </View>
          )}

          <Text className="text-ink text-sm font-medium mb-1.5">E-mail ou matrícula</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-ink text-base mb-4"
            placeholder="seu@email.com ou F12345"
            placeholderTextColor="#9CA3AF"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text className="text-ink text-sm font-medium mb-1.5">Senha</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 mb-2">
            <TextInput
              className="flex-1 py-3 text-ink text-base"
              placeholder="Sua senha"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)} className="pl-2 py-2">
              <Text className="text-ink-muted text-sm">{showPwd ? 'Ocultar' : 'Mostrar'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="self-end mb-6">
            <Text className="text-primary text-sm">Esqueci a senha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className={`bg-primary rounded-xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold text-base">Entrar</Text>
            }
          </TouchableOpacity>

          <View className="items-center mt-8">
            <Text className="text-ink-subtle text-xs">
              Acesso exclusivo para membros cadastrados pela escola.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
