import { Screen } from '@/components/ui/Screen';
import { ClockButton } from '@/components/ClockButton';

export default function TeacherPonto() {
  return (
    <Screen title="Registro de Ponto" scroll={false}>
      <ClockButton />
    </Screen>
  );
}
