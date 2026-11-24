import type { BuildingsSnapshot } from "./buildings";

const http = game.GetService("HttpService");

/** Contrato que o adaptador DataStore da Fase 7 também vai cumprir. */
export interface WorldRepository {
	load(worldId: string): BuildingsSnapshot | undefined;
	save(worldId: string, snapshot: BuildingsSnapshot): void;
}

/** Guarda o snapshot serializado, para expor cedo dados que não sobrevivem a JSON. */
export class MemoryRepository implements WorldRepository {
	private readonly records = new Map<string, string>();

	public load(worldId: string): BuildingsSnapshot | undefined {
		const record = this.records.get(worldId);
		return record === undefined ? undefined : (http.JSONDecode(record) as BuildingsSnapshot);
	}

	public save(worldId: string, snapshot: BuildingsSnapshot) {
		this.records.set(worldId, http.JSONEncode(snapshot));
	}
}
