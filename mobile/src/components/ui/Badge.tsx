import { View, Text } from 'react-native';

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'neutral';

const bg: Record<Tone, string> = {
  primary: 'bg-primary-soft',
  success: 'bg-success-soft',
  danger: 'bg-danger-soft',
  warning: 'bg-warning-soft',
  neutral: 'bg-canvas',
};
const txt: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  neutral: 'text-ink-muted',
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${bg[tone]}`}>
      <Text className={`text-xs font-semibold ${txt[tone]}`}>{label}</Text>
    </View>
  );
}
