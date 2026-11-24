import type { PlayerState } from "./protocol";
import { FACT_CHAPTER_ONE, FACT_GUARDIAN_RECORD } from "./research";

export interface Mission {
	readonly id: string;
	readonly title: string;
	readonly objective: string;
	readonly hint: string;
	/** Falas de ECHO ao abrir a missão. */
	readonly echo: ReadonlyArray<string>;
	readonly isDone: (state: PlayerState) => boolean;
}

/** Capítulo 1 — O Despertar. Cada missão avança por um fato confirmado pelo servidor. */
export const MISSIONS: ReadonlyArray<Mission> = [
	{
		id: "awakening.supplies",
		title: "Primeiros insumos",
		objective: "Minere ferro e carvão",
		hint: "Segure E nos depósitos do posto ou nas jazidas do mundo.",
		echo: [
			"Você está ouvindo? Sou ECHO. Parte da minha memória não responde, mas posso guiar você.",
			"A energia principal caiu. Minere ferro e carvão nos depósitos à sua frente.",
		],
		isDone: (state) => state.suppliesReady,
	},
	{
		id: "awakening.power",
		title: "Luz de serviço",
		objective: "Restaure o gerador",
		hint: "Clique no gerador amarelo, restaure e abasteça com carvão.",
		echo: ["Há um gerador de emergência no posto. Com dois minérios e algum carvão, ele volta."],
		isDone: (state) => state.generatorRestored,
	},
	{
		id: "awakening.automation",
		title: "Linha de suprimento",
		objective: "Entregue um componente pela linha",
		hint: "Aperte B. Mineradora no veio → esteira → fornalha → esteira → montadora → esteira → armazém.",
		echo: [
			"Os sensores voltaram. O setor de manutenção recebeu uma ordem de evacuação. A saída foi selada depois disso.",
			"Para abrir a saída, preciso de um componente. Monte uma linha que o produza sozinha.",
		],
		isDone: (state) => state.automationDone,
	},
	{
		id: "awakening.access",
		title: "Setor de manutenção",
		objective: "Pesquise o acesso no terminal",
		hint: "Retire 1 componente do armazém e use o terminal de ECHO.",
		echo: ["Esse terminal interpreta componentes. Entregue um e eu descubro como abrir o setor."],
		isDone: (state) => state.research.completed.includes("maintenance_access"),
	},
	{
		id: "awakening.recovery",
		title: "Última ordem",
		objective: "Recupere o registro do Guardião",
		hint: "Entre pela porta do setor de manutenção, derrote o Guardião e extraia.",
		echo: ["A porta do setor está liberada.", "Algo lá dentro ainda cumpre a última ordem. Traga o registro e volte vivo."],
		isDone: (state) => state.facts.includes(FACT_GUARDIAN_RECORD),
	},
	{
		id: "awakening.signal",
		title: "O sinal de retorno",
		objective: "Pesquise a Leitura de Sinal",
		hint: "Leve 1 fragmento antigo e 1 componente ao terminal. Depois fale com ECHO.",
		echo: ["A ordem tem o identificador GENESIS. Eu me lembro do nome. O resto foi removido."],
		isDone: (state) => state.facts.includes(FACT_CHAPTER_ONE),
	},
];

export const CHAPTER_END: ReadonlyArray<string> = [
	"O sinal está chegando de cima. Se quiser saber quem enviou a ordem, é por lá que começamos.",
	"Fim do Capítulo 1 — O Despertar. Sua fábrica continua em operação.",
];

export function currentMission(state: PlayerState): Mission | undefined {
	return MISSIONS.find((mission) => !mission.isDone(state));
}
