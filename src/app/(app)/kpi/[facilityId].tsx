import { useLocalSearchParams } from 'expo-router';

import { FacilityDetail } from '@/components/kpi/facility-detail';

export default function KpiFacilityScreen() {
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();

  return <FacilityDetail facilityId={String(facilityId)} />;
}
