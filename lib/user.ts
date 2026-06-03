const USER_ID_KEY = 'splice_user_id';
const USER_NAME_KEY = 'splice_user_name';

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_KEY);
}

export function setUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
}

export function getUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_NAME_KEY);
}

export function setUserName(name: string): void {
  localStorage.setItem(USER_NAME_KEY, name);
}

export function clearUser(): void {
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_NAME_KEY);
}
