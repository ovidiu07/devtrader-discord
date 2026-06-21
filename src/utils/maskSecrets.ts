export function maskSecrets(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function maskKnownSecrets(message: string): string {
  const secrets = [process.env.DISCORD_BOT_TOKEN, process.env.CURRENTS_API_KEY].filter((secret): secret is string => Boolean(secret));
  return secrets.reduce((current, secret) => current.split(secret).join(maskSecrets(secret)), message);
}
