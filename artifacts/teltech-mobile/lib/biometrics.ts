import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const BIOMETRIC_ENABLED_KEY = 'teltech_biometric_enabled';
export const CREDENTIALS_KEY = 'teltech_credentials';

export type BiometricType = 'face' | 'fingerprint' | 'none';

export async function isBiometricAvailable(): Promise<{ available: boolean; type: BiometricType }> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { available: false, type: 'none' };
  }

  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { available: true, type: 'face' };
  } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available: true, type: 'fingerprint' };
  }

  return { available: true, type: 'none' };
}

export async function isBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === 'true';
}

export async function enableBiometric(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autenticar no Teltech Ledger',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return false;
  }
}

export async function getBiometricLabel(): Promise<string> {
  const { type } = await isBiometricAvailable();
  if (type === 'face') return 'Face ID';
  if (type === 'fingerprint') return 'Touch ID';
  return 'Biometria';
}
