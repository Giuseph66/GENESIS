import { Codec, createMemoryStore, Transform, WorldStore } from "./store";

const PROBE_KEY = "probe";

function jsonCodec(): Codec {
	const http = game.GetService("HttpService");
	return {
		encode: (value) => http.JSONEncode(value),
		decode: (text) => http.JSONDecode(text),
	};
}

export function createDataStore(name: string): WorldStore {
	const dataStore = game.GetService("DataStoreService").GetDataStore(name);
	return {
		durable: true,
		read: (key) => {
			const options = new Instance("DataStoreGetOptions");
			options.UseCache = false;
			const [ok, result] = pcall(() => dataStore.GetAsync(key, options)[0] as unknown);
			return ok ? { ok: true, value: result } : { ok: false, problem: tostring(result) };
		},
		update: (key, transform: Transform) => {
			const [ok, problem] = pcall(() => {
				dataStore.UpdateAsync(key, (current: unknown) => $tuple(transform(current)));
			});
			return ok ? { ok: true } : { ok: false, problem: tostring(problem) };
		},
	};
}

export interface StoreChoice {
	readonly store: WorldStore;
	readonly durable: boolean;
	/** Motivo do uso de memória, quando for o caso. */
	readonly problem?: string;
}

/**
 * No Studio sem acesso à API, usa memória. Em servidor publicado nunca troca: uma falha do
 * serviço deve deixar o mundo indisponível em vez de abrir um mundo vazio.
 */
export function createStore(name: string): StoreChoice {
	const memory = (problem: unknown): StoreChoice => {
		const { store } = createMemoryStore(jsonCodec());
		return { store, durable: false, problem: tostring(problem) };
	};
	const isStudio = game.GetService("RunService").IsStudio();
	const [created, store] = pcall(() => createDataStore(name));
	if (!created) {
		if (isStudio) return memory(store);
		error(`Armazenamento indisponível: ${tostring(store)}`);
	}
	if (!isStudio) return { store, durable: true };
	const probe = store.read(PROBE_KEY);
	return probe.ok ? { store, durable: true } : memory(probe.problem);
}
