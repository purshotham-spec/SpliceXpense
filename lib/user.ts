const USER_ID_KEY = 'splice_user_id';
const USER_NAME_KEY = 'splice_user_name';

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem(USER_ID_KEY);
  if (fromStorage) return fromStorage;
  // iOS Safari clears localStorage — recover from cookie
  const fromCookie = getCookie(USER_ID_KEY);
  if (fromCookie) {
    localStorage.setItem(USER_ID_KEY, fromCookie);
    return fromCookie;
  }
  return null;
}

export function setUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
  setCookie(USER_ID_KEY, id);
}

export function getUserName(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem(USER_NAME_KEY);
  if (fromStorage) return fromStorage;
  const fromCookie = getCookie(USER_NAME_KEY);
  if (fromCookie) {
    localStorage.setItem(USER_NAME_KEY, fromCookie);
    return fromCookie;
  }
  return null;
}

export function setUserName(name: string): void {
  localStorage.setItem(USER_NAME_KEY, name);
  setCookie(USER_NAME_KEY, name);
}

export function clearUser(): void {
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  setCookie(USER_ID_KEY, '', -1);
  setCookie(USER_NAME_KEY, '', -1);
}
