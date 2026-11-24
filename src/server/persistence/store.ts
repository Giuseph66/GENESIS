/** Leitura sem cache, para resolver dúvidas sobre o que foi gravado. */
export type ReadReply = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly problem: string };

/** Falha não prova que nada foi gravado: a resposta pode ter se perdido. */
export type UpdateReply = { readonly ok: true } | { readonly ok: false; readonly problem: string };

/**
 * Recebe o valor atual e devolve o novo. `undefined` cancela a gravação.
 * Pode ser executada várias vezes e não pode esperar nem ter efeito externo.
 */
export type Transform = (current: unknown) => unknown;

export interface WorldStore {
	/** Falso quando os dados somem com o servidor. */
	readonly durable: boolean;
	readonly read: (key: string) => ReadReply;
	readonly update: (key: string, transform: Transform) => UpdateReply;
}

/** Serialização usada para isolar o que está guardado do que está em uso. */
export interface Codec {
	readonly encode: (value: unknown) => string;
	readonly decode: (text: string) => unknown;
}

/** Comportamento da próxima gravação do adaptador em memória. */
export type Fault =
	/** Falha sem gravar. */
	| "error"
	/** Grava e perde a resposta. */
	| "lost_response"
	/** Executa a transformação, descarta o resultado e executa de novo. */
	| "conflict";

export interface MemoryControls {
	/** Falhas consumidas em ordem, uma por gravação. */
	readonly faults: Array<Fault>;
	/** Falhas consumidas em ordem, uma por leitura. */
	readonly readFaults: Array<"error">;
	/** Executado entre as duas tentativas de um conflito, como outro servidor faria. */
	onConflict?: () => void;
	readonly peek: (key: string) => unknown;
	readonly poke: (key: string, value: unknown) => void;
	/** Gravações confirmadas no armazenamento. */
	writes: number;
}

export function createMemoryStore(codec: Codec): { readonly store: WorldStore; readonly controls: MemoryControls } {
	const records = new Map<string, string>();
	const decode = (key: string): unknown => {
		const text = records.get(key);
		return text === undefined ? undefined : codec.decode(text);
	};
	const controls: MemoryControls = {
		faults: [],
		readFaults: [],
		peek: decode,
		poke: (key, value) => {
			records.set(key, codec.encode(value));
		},
		writes: 0,
	};

	const store: WorldStore = {
		durable: false,
		read: (key) => {
			if (controls.readFaults.shift()) return { ok: false, problem: "leitura recusada" };
			return { ok: true, value: decode(key) };
		},
		update: (key, transform) => {
			const fault = controls.faults.shift();
			if (fault === "error") return { ok: false, problem: "gravação recusada" };
			if (fault === "conflict") {
				transform(decode(key));
				controls.onConflict?.();
			}
			const value = transform(decode(key));
			if (value !== undefined) {
				records.set(key, codec.encode(value));
				controls.writes += 1;
			}
			return fault === "lost_response" ? { ok: false, problem: "resposta perdida" } : { ok: true };
		},
	};
	return { store, controls };
}
