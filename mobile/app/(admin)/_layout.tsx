import { RoleTabs } from '@/components/TabBar';

export default function AdminLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index',        title: 'Dashboard',  icon: 'stats-chart' },
        { name: 'alunos',       title: 'Alunos',     icon: 'school' },
        { name: 'funcionarios', title: 'Equipe',     icon: 'people' },
        { name: 'financeiro',   title: 'Financeiro', icon: 'cash' },
        { name: 'ponto',        title: 'Ponto',      icon: 'time' },
        { name: 'ferias',       title: 'Férias',     icon: 'airplane' },
      ]}
    />
  );
}
