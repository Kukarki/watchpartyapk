import React from 'react';
import { router } from 'expo-router';
import { SettingsScreen } from '../../../wp-ui';
import { useAuthStore } from '@/stores/auth.store';

export default function SettingsRoute() {
  const { user } = useAuthStore();

  return (
    <SettingsScreen
      name={user?.username ?? ''}
      email={user?.email ?? ''}
      appVersion="1.0.0"
      onBack={() => router.back()}
      go={(screen: string) => {
        if (screen === 'account') router.push('/(app)/settings/account');
        // TODO: route to the new Ready Player Me avatar closet once it exists
        else if (screen === 'avatar') { /* no-op until rebuilt */ }
        else router.push({ pathname: '/(app)/settings/[pref]', params: { pref: screen } });
      }}
    />
  );
}
