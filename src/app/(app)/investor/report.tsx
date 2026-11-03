import { InvestorReportScreen } from '@/components/investor/report-screen';

/**
 * `/investor/report?locationId=…&kind=profit-loss`
 *
 * One of the three reports on a property, chosen from its detail panel.
 */
export default function InvestorReportRoute() {
  return <InvestorReportScreen />;
}
