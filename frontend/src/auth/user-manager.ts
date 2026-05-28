import { UserManager } from "oidc-client-ts";
import { getOidcSettings } from "./oidc-config";

let manager: UserManager | null = null;

export function getUserManager(): UserManager {
  if (!manager) {
    manager = new UserManager(getOidcSettings());
  }
  return manager;
}
