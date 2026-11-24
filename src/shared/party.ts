export type Grant = "build" | "remove" | "transfer";
export type Grants = { readonly [grant in Grant]: boolean };
export type Role = "owner" | "member" | "visitor";

/** Inclui o proprietário. */
export const MAX_MEMBERS = 4;
export const INVITE_SECONDS = 60;
export const GRANTS: ReadonlyArray<{ readonly id: Grant; readonly name: string }> = [
	{ id: "build", name: "Construir" },
	{ id: "remove", name: "Remover" },
	{ id: "transfer", name: "Armazém" },
];
export const ALL_GRANTS: Grants = { build: true, remove: true, transfer: true };
export const NO_GRANTS: Grants = { build: false, remove: false, transfer: false };
/** Quem acaba de entrar ajuda a construir, mas não desfaz o que é dos outros. */
export const NEW_MEMBER_GRANTS: Grants = { build: true, remove: false, transfer: true };

export interface PartyEntry {
	readonly userId: number;
	readonly name: string;
	readonly role: Role;
	readonly online: boolean;
	readonly invited: boolean;
	readonly grants: Grants;
}
