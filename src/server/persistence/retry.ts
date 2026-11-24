export interface RetryRules {
	readonly attempts: number;
	readonly baseSeconds: number;
	readonly maxSeconds: number;
}

export const RETRY: RetryRules = { attempts: 4, baseSeconds: 0.5, maxSeconds: 8 };

/** Espera exponencial com jitter, entre metade e o total do intervalo. `random` fica em [0, 1). */
export function backoffSeconds(failures: number, random: () => number, rules = RETRY): number {
	const full = math.min(rules.maxSeconds, rules.baseSeconds * 2 ** math.max(0, failures - 1));
	return full * (0.5 + random() * 0.5);
}
