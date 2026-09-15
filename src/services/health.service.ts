export interface HealthStatus {
  status: 'ok';
  uptime: number;
}

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    uptime: Math.round(process.uptime()),
  };
}
