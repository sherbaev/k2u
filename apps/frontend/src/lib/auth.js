/**
 * Cosmetic client-side auth gate for the beta build. Real authentication is
 * disabled on the backend for now — this only controls whether the app
 * shell is shown, so screenshots/demos have a normal "sign in" flow.
 */
const KEY = "k2u_auth";
const USER_KEY = "k2u_auth_user";

export function isAuthed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** @param {string} username */
export function signIn(username) {
  try {
    localStorage.setItem(KEY, "1");
    localStorage.setItem(USER_KEY, username || "admin");
  } catch {
    // ignore storage errors (private browsing, etc.)
  }
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export function currentUser() {
  try {
    return localStorage.getItem(USER_KEY) || "admin";
  } catch {
    return "admin";
  }
}
