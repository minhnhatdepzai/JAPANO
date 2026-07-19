import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { hydrated, isAuthenticated } = useAuth();
  if (!hydrated) return null;
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/onboarding'} />;
}
