import { View } from 'react-native';

interface Props { children: React.ReactNode; className?: string }

export function Card({ children, className = '' }: Props) {
  return (
    <View className={`bg-surface rounded-2xl border border-border p-4 mb-3 ${className}`}>
      {children}
    </View>
  );
}
