import { ALL_GRANTS, Grant, Grants, INVITE_SECONDS, MAX_MEMBERS, NEW_MEMBER_GRANTS, NO_GRANTS, Role } from "../shared/party";
import type { Reason } from "../shared/protocol";

export interface MemberGrants extends Grants {
	readonly userId: number;
}

export interface PermissionsSnapshot {
	readonly members: ReadonlyArray<MemberGrants>;
}

/** Quem pode o quê no mundo. Só o proprietário convida, concede e expulsa. */
export class Permissions {
	private readonly members = new Map<number, Grants>();
	private readonly invites = new Map<number, number>();

	constructor(public readonly ownerId: number) {}

	public role(userId: number): Role {
		if (userId === this.ownerId) return "owner";
		return this.members.has(userId) ? "member" : "visitor";
	}

	public grants(userId: number): Grants {
		if (userId === this.ownerId) return ALL_GRANTS;
		return this.members.get(userId) ?? NO_GRANTS;
	}

	public can(userId: number, grant: Grant): boolean {
		return this.grants(userId)[grant];
	}

	public isInvited(userId: number, now: number): boolean {
		const expires = this.invites.get(userId);
		return expires !== undefined && now < expires;
	}

	public invite(by: number, target: number, now: number): Reason {
		if (by !== this.ownerId) return "NOT_AUTHORIZED";
		if (this.role(target) !== "visitor") return "INVALID_REQUEST";
		if (this.isFull()) return "PARTY_FULL";
		this.invites.set(target, now + INVITE_SECONDS);
		return "OK";
	}

	/** O convite é consumido na resposta. A lotação é conferida de novo ao aceitar. */
	public answer(userId: number, accept: boolean, now: number): Reason {
		if (!this.isInvited(userId, now)) return "INVITE_EXPIRED";
		this.invites.delete(userId);
		if (!accept) return "OK";
		if (this.isFull()) return "PARTY_FULL";
		this.members.set(userId, NEW_MEMBER_GRANTS);
		return "OK";
	}

	public setGrant(by: number, target: number, grant: Grant, enabled: boolean): Reason {
		if (by !== this.ownerId) return "NOT_AUTHORIZED";
		const current = this.members.get(target);
		if (!current) return "NOT_FOUND";
		this.members.set(target, {
			build: grant === "build" ? enabled : current.build,
			remove: grant === "remove" ? enabled : current.remove,
			transfer: grant === "transfer" ? enabled : current.transfer,
		});
		return "OK";
	}

	/** O membro também pode sair por conta própria. */
	public expel(by: number, target: number): Reason {
		if (by !== this.ownerId && by !== target) return "NOT_AUTHORIZED";
		this.invites.delete(target);
		return this.members.delete(target) ? "OK" : "NOT_FOUND";
	}

	/** Em ordem de ID, para a interface e o salvamento serem estáveis. */
	public memberIds(): Array<number> {
		const ids = new Array<number>();
		for (const [userId] of this.members) ids.push(userId);
		ids.sort((a, b) => a < b);
		return ids;
	}

	public snapshot(): PermissionsSnapshot {
		return {
			members: this.memberIds().map((userId) => {
				const { build, remove, transfer } = this.grants(userId);
				return { userId, build, remove, transfer };
			}),
		};
	}

	public static restore(ownerId: number, snapshot: PermissionsSnapshot): Permissions {
		assert(snapshot.members.size() < MAX_MEMBERS, "Membros demais no snapshot.");
		const permissions = new Permissions(ownerId);
		for (const { userId, build, remove, transfer } of snapshot.members) {
			assert(typeIs(userId, "number") && math.floor(userId) === userId && userId !== ownerId, "Membro inválido.");
			assert(!permissions.members.has(userId), "Membro repetido.");
			assert(typeIs(build, "boolean") && typeIs(remove, "boolean") && typeIs(transfer, "boolean"), "Concessão inválida.");
			permissions.members.set(userId, { build, remove, transfer });
		}
		return permissions;
	}

	private isFull(): boolean {
		return this.members.size() + 1 >= MAX_MEMBERS;
	}
}
