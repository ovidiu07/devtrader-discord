import { maskKnownSecrets } from "./maskSecrets.js";

export const logger = {
  info(message: string) {
    console.log(maskKnownSecrets(message));
  },
  warn(message: string) {
    console.warn(maskKnownSecrets(message));
  },
  error(message: string) {
    console.error(maskKnownSecrets(message));
  }
};
