import { UserManagerSettings, WebStorageStateStore } from "oidc-client-ts";

const authority = import.meta.env.VITE_AUTHORITY ?? "http://localhost:8080/realms/crash-game";
const client_id = import.meta.env.VITE_CLIENT_ID ?? "crash-game-client";

function redirect_uri(): string {
  return `${window.location.origin}/auth/callback`;
}

export function getOidcSettings(): UserManagerSettings {
  return {
    authority,
    client_id,
    redirect_uri: redirect_uri(),
    response_type: "code",
    scope: "openid profile email",
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  };
}
