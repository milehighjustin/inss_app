import { useState } from 'react';

import { MetroEmpty, MetroPivot, MetroScreen } from '@/components/metro';
import { AdminPivot } from './admin-pivot';
import { DocumentsAdmin } from './documents-screen';
import { EquityAdmin } from './equity-screen';
import { InvestorLocations } from './investor-locations-screen';
import { InvestorsAdmin } from './investors-screen';

/** v1's Investor Portal panel, tab for tab. */
const TABS = [
  { value: 'investors', label: 'Investors' },
  { value: 'locations', label: 'Locations' },
  { value: 'documents', label: 'Documents' },
  { value: 'equity', label: 'Equity' },
  { value: 'dividends', label: 'Dividends' },
];

/** Admin → Investor Portal. */
export function InvestorsAdminPage() {
  const [tab, setTab] = useState('investors');

  return (
    <MetroScreen
      eyebrow="Admin"
      title="Investor Portal"
      subtitle="Who invests, the properties they hold, and the files they can open."
      width="wide">
      <AdminPivot />
      <MetroPivot tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'investors' ? <InvestorsAdmin /> : null}
      {tab === 'locations' ? <InvestorLocations /> : null}
      {tab === 'documents' ? <DocumentsAdmin /> : null}
      {tab === 'equity' ? <EquityAdmin /> : null}
      {tab === 'dividends' ? (
        <MetroEmpty
          title="Dividends"
          message="v1's Dividends tab was never built either — it printed the word and nothing else. This is where distributions will land once there is a source for them."
        />
      ) : null}
    </MetroScreen>
  );
}
