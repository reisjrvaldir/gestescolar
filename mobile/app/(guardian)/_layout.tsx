import { RoleTabs } from '@/components/TabBar';

export default function GuardianLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index',      title: 'Filhos',     icon: 'people' },
        { name: 'notas',      title: 'Notas',      icon: 'stats-chart' },
        { name: 'frequencia', title: 'Frequência', icon: 'calendar' },
        { name: 'faturas',    title: 'Faturas',    icon: 'card' },
        { name: 'chat',       title: 'Mensagens',  icon: 'mail' },
      ]}
    />
  );
}
