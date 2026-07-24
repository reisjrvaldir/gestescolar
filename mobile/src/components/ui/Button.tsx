import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

type Variant = 'primary' | 'outline' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const base = 'flex-row items-center justify-center rounded-xl px-4 py-3';
const variants: Record<Variant, string> = {
  primary: 'bg-primary',
  outline: 'border border-primary bg-transparent',
  danger: 'bg-danger',
  ghost: 'bg-transparent',
};
const textVariants: Record<Variant, string> = {
  primary: 'text-white font-semibold text-base',
  outline: 'text-primary font-semibold text-base',
  danger: 'text-white font-semibold text-base',
  ghost: 'text-ink-muted text-base',
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, className = '' }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      className={`${base} ${variants[variant]} ${(loading || disabled) ? 'opacity-50' : ''} ${className}`}
    >
      {loading && <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#1A56DB'} className="mr-2" />}
      <Text className={textVariants[variant]}>{label}</Text>
    </TouchableOpacity>
  );
}
