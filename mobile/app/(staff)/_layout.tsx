import { RoleTabs } from '@/components/TabBar';

export default function StaffLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index',  title: 'Início', icon: 'home' },
        { name: 'ponto',  title: 'Ponto',  icon: 'time' },
        { name: 'ferias', title: 'Férias', icon: 'airplane' },
      ]}
    />
  );
}
