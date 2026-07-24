import { SafeAreaView, ScrollView, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface Props {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
}

export function Screen({ title, children, scroll = true, className = '' }: Props) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      {title && (
        <View className="px-4 pt-2 pb-3 bg-surface border-b border-border">
          <Text className="text-xl font-bold text-ink">{title}</Text>
        </View>
      )}
      <Wrapper
        className={`flex-1 ${className}`}
        contentContainerStyle={scroll ? { padding: 16 } : undefined}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}
