import type { Counts } from "./catalog";

export type ResearchId = "maintenance_access" | "signal_reading";

/** Fatos gravados no membro do mundo. */
export const FACT_GUARDIAN_DEFEATED = "guardian_defeated";
export const FACT_GUARDIAN_RECORD = "guardian_record";
export const FACT_CHAPTER_ONE = "chapter_one_done";

export interface ResearchType {
	readonly id: ResearchId;
	readonly name: string;
	readonly cost: Counts;
	readonly seconds: number;
	/** Exige o fato de produção automática, mesmo que o jogador já tenha o componente. */
	readonly needsAutomation: boolean;
	readonly needsFact?: string;
}

export const RESEARCH: ReadonlyArray<ResearchType> = [
	{
		id: "maintenance_access",
		name: "Acesso ao Setor de Manutenção",
		cost: { component: 1 },
		seconds: 10,
		needsAutomation: true,
	},
	{
		id: "signal_reading",
		name: "Leitura de Sinal",
		cost: { ancient_fragment: 1, component: 1 },
		seconds: 15,
		needsAutomation: true,
		needsFact: FACT_GUARDIAN_RECORD,
	},
];

export interface ResearchState {
	readonly completed: ReadonlyArray<ResearchId>;
	readonly active?: ResearchId;
	/** Segundos restantes da pesquisa ativa. */
	readonly left: number;
}
