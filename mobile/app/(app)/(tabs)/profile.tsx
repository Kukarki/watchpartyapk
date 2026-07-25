import React from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { ProfileTabScreen } from '../../../wp-ui';

// TODO: Ready Player Me avatar creator + inventory/shop screens go here
// (backend is already live at /api/v1/avatar-system, see backend/src/avatar/).
export default function ProfileScreen() {
  const { user } = useAuthStore();

  return (
    <ProfileTabScreen
      name={user?.username ?? 'You'}
      stats={null}
      AvatarHero={null}
      onEditAvatar={() => {}}
      onInventory={() => {}}
      onShop={() => {}}
      onSettings={() => router.push('/(app)/settings' as any)}
      onAchievements={() => router.push('/(app)/achievements' as any)}
      onShare={() => {}}
      onOpenFriends={() => router.push('/(app)/(tabs)/friends' as any)}
      onOpenRooms={() => router.push('/(app)/(tabs)/rooms' as any)}
    />
  );
}
