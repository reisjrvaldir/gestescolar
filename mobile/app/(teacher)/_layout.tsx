import { RoleTabs } from '@/components/TabBar';

export default function TeacherLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index',    title: 'Início',   icon: 'home' },
        { name: 'ponto',    title: 'Ponto',    icon: 'time' },
        { name: 'chamada',  title: 'Chamada',  icon: 'checkbox' },
        { name: 'notas',    title: 'Notas',    icon: 'create' },
        { name: 'jornada',  title: 'Jornada',  icon: 'calendar' },
        { name: 'ferias',   title: 'Férias',   icon: 'airplane' },
        { name: 'chat',     title: 'Mensagens', icon: 'mail' },
      ]}
    />
  );
}
