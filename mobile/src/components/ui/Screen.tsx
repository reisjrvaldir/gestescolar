import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

interface Props {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  right?: React.ReactNode;
}

export function Screen({ title, children, scroll = true, className = '', right }: Props) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      {title && (
        <View className="flex-row items-center justify-between px-4 pt-1 pb-3 bg-surface border-b border-border">
          <Text className="text-xl font-bold text-ink">{title}</Text>
          {right}
        </View>
      )}
      <Wrapper
        className={`flex-1 ${className}`}
        contentContainerStyle={scroll ? { padding: 16, paddingBottom: 32 } : undefined}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}
