import React, { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CoFlowD8sView } from '../components/CoFlowD8sView';
import { CarePeopleRegistry } from '../components/CarePeopleRegistry';
import { Users, Calendar } from 'lucide-react';

export function CarePage() {
  const { data, actions } = useDashboard();
  const [activeTab, setActiveTab] = useState<'people' | 'gatherings'>('people');

  const state =
    !data.permissions.careConsent ? 'restricted' :
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' :
    (data.stations.length === 0 && data.coFlowDates.length === 0 && data.coFlowCheckins.length === 0) ? 'empty' : 'fresh';

  return (
    <ViewShell
      state={state}
      emptyTitle="No care loop scheduled"
      emptyBody="The next right invitation will appear here when it's time. Nothing to act on right now."
      restrictedTitle="Care Loop — consent required"
      restrictedBody="Contact CTAs and scheduling are suppressed until consent is confirmed. Reach out directly to update your settings."
      onRetry={actions.retrySync}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '16px 20px 40px' }}>
        {/* Sub-tab navigation */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          borderBottom: '1px solid var(--border-soft, #E0DBD5)',
          paddingBottom: 12,
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('people')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'people' ? 'var(--cr8w-primary, #C25B38)' : 'var(--bg-card, #FFF)',
              color: activeTab === 'people' ? '#fff' : 'var(--text-secondary)',
              fontFamily: 'var(--font-label)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'people' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={15} />
            <span>People & Care Loop</span>
            <span style={{
              background: activeTab === 'people' ? 'rgba(255,255,255,0.25)' : 'var(--sandstone, rgba(0,0,0,0.06))',
              color: activeTab === 'people' ? '#fff' : 'var(--text-muted)',
              padding: '1px 6px',
              borderRadius: 10,
              fontSize: '0.65rem',
            }}>
              {data.stations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gatherings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'gatherings' ? 'var(--cr8w-primary, #C25B38)' : 'var(--bg-card, #FFF)',
              color: activeTab === 'gatherings' ? '#fff' : 'var(--text-secondary)',
              fontFamily: 'var(--font-label)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'gatherings' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Calendar size={15} />
            <span>PlayD8s & Gatherings</span>
            {data.coFlowDates.length > 0 && (
              <span style={{
                background: activeTab === 'gatherings' ? 'rgba(255,255,255,0.25)' : 'var(--sandstone, rgba(0,0,0,0.06))',
                color: activeTab === 'gatherings' ? '#fff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: '0.65rem',
              }}>
                {data.coFlowDates.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'people' ? (
          <CarePeopleRegistry
            stations={data.stations}
            onUpdateStationField={actions.updateStationField}
            onAddStation={actions.addStation}
            onDeleteStation={actions.deleteStation}
          />
        ) : (
          <CoFlowD8sView
            coflowDates={data.coFlowDates}
            coflowCheckins={data.coFlowCheckins}
            onAddCoFlowDate={actions.addCoFlowDate}
            onUpdateCoFlowDate={actions.updateCoFlowDate}
            onDeleteCoFlowDate={actions.deleteCoFlowDate}
            onAddCoFlowCheckin={actions.addCoFlowCheckin}
            onDeleteCoFlowCheckin={actions.deleteCoFlowCheckin}
          />
        )}
      </div>
    </ViewShell>
  );
}
