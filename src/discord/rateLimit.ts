export async function withDiscordRateLimitHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const maybeRateLimited = error as { status?: number; retry_after?: number; rawError?: { retry_after?: number } };
    const retryAfter = maybeRateLimited.retry_after ?? maybeRateLimited.rawError?.retry_after;
    if (maybeRateLimited.status === 429 && retryAfter) {
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(retryAfter * 1000)));
      return operation();
    }
    throw error;
  }
}
