export interface RateLimiterBackend {
  record(ip: string): Promise<number>;
  distinctPathsInWindow(ip: string, path: string): Promise<number>;
}
