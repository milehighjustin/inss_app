import { useState } from 'react';

import { MetroBanner, MetroButton, MetroField, MetroSelect, MetroSheet } from '@/components/metro';
import { ASSIGNABLE_ROLES, createUser, roleLabel, type AdminUser } from '@/lib/admin/users';

export interface CreateUserSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the new user after the server accepts it. */
  onCreated: (user: AdminUser) => void;
}

/**
 * Create a user, matching v1's modal: first name, last name, optional email and
 * one role. No password is set here — v1 does not set one either.
 */
export function CreateUserSheet({ visible, onClose, onCreated }: CreateUserSheetProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('manager');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setRole('manager');
    setError(null);
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setError(null);

    if (!firstName.trim()) return setError('First name is required');
    if (!lastName.trim()) return setError('Last name is required');

    setSaving(true);
    try {
      const user = await createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        roles: [role],
      });
      reset();
      onCreated(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the user');
      setSaving(false);
    }
  };

  return (
    <MetroSheet
      visible={visible}
      title="Create user"
      description="Enter the new user's details. They will sign in with the same account system as the website."
      onClose={close}
      actions={
        <>
          <MetroButton label="Create user" loading={saving} onPress={submit} />
          <MetroButton label="Cancel" variant="ghost" onPress={close} />
        </>
      }>
      {error ? <MetroBanner message={error} tone="error" /> : null}

      <MetroField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
      />
      <MetroField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <MetroField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        hint="Optional, but needed for a magic-link sign-in."
      />
      <MetroSelect
        label="Role"
        options={ASSIGNABLE_ROLES.map((value) => ({ value, label: roleLabel(value) }))}
        value={role}
        onChange={setRole}
      />
    </MetroSheet>
  );
}
