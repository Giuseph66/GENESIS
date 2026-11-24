import { EnemyAttack, EnemyType, Flat, flatDirection, flatDistance } from "../shared/combat";

export type EnemyState = "Idle" | "Patrol" | "Search" | "Chase" | "Attack" | "Retreat" | "Dead";

/** Alvo percebido neste passo. Sem alvo vivo, é `undefined`. */
export interface Perception {
	readonly position: Flat;
	readonly visible: boolean;
}

/** Golpe com mira travada no início do aviso. */
export interface Swing {
	readonly attack: EnemyAttack;
	readonly origin: Flat;
	readonly aim: Flat;
}

export interface EnemyEvent {
	readonly kind: "telegraph" | "strike";
	readonly swing: Swing;
}

const IDLE_SECONDS = 1;
const SEARCH_SECONDS = 4;
const ARRIVAL = 1.5;
const PATROL_RADIUS = 8;

/** Decide estado, destino e golpes. Quem chama move o corpo e atualiza `position`. */
export class Enemy {
	public state: EnemyState = "Idle";
	public health: number;
	public position: Flat;
	public aim: Flat = { x: 0, z: 1 };
	/** Para onde o corpo deve andar. `undefined` significa parado. */
	public destination?: Flat;

	private stateSince = 0;
	private lastKnown?: Flat;
	private patrolStep = 0;
	private attackReadyAt = 0;
	private attackIndex = 0;
	private chainLeft = 0;
	private swing?: Swing;
	private struck = false;

	constructor(
		public readonly kind: EnemyType,
		private readonly home: Flat,
	) {
		this.health = kind.health;
		this.position = home;
	}

	/** Devolve o dano aplicado. Um inimigo morto não recebe dano de novo. */
	public damage(amount: number, now: number): number {
		if (this.state === "Dead" || amount <= 0) return 0;
		const applied = math.min(this.health, amount);
		this.health -= applied;
		if (this.health <= 0) {
			this.swing = undefined;
			this.destination = undefined;
			this.enter("Dead", now);
		}
		return applied;
	}

	public update(now: number, target: Perception | undefined): EnemyEvent | undefined {
		if (this.state === "Dead") return undefined;
		if (this.state === "Attack") return this.updateAttack(now, target);

		const seen =
			target && target.visible && flatDistance(this.position, target.position) <= this.kind.sight ? target : undefined;
		if (seen) this.lastKnown = seen.position;

		if (this.state === "Retreat") {
			this.destination = this.home;
			if (flatDistance(this.position, this.home) <= ARRIVAL) this.enter("Idle", now);
			return undefined;
		}
		if (this.state !== "Chase" && seen) this.enter("Chase", now);

		if (this.state === "Chase") return this.updateChase(now, seen);
		if (this.state === "Search") {
			this.destination = this.lastKnown;
			if (!this.lastKnown || now - this.stateSince >= SEARCH_SECONDS) this.enter("Retreat", now);
			return undefined;
		}
		if (this.state === "Idle") {
			this.destination = undefined;
			if (now - this.stateSince >= IDLE_SECONDS) this.enter("Patrol", now);
			return undefined;
		}

		const angle = this.patrolStep * (math.pi / 2);
		const point = { x: this.home.x + math.cos(angle) * PATROL_RADIUS, z: this.home.z + math.sin(angle) * PATROL_RADIUS };
		this.destination = point;
		if (flatDistance(this.position, point) <= ARRIVAL) {
			this.patrolStep += 1;
			this.enter("Idle", now);
		}
		return undefined;
	}

	private updateChase(now: number, seen: Perception | undefined): EnemyEvent | undefined {
		if (flatDistance(this.position, this.home) > this.kind.leash) {
			this.enter("Retreat", now);
			return undefined;
		}
		if (!seen) {
			this.enter("Search", now);
			return undefined;
		}

		const direction = flatDirection(this.position, seen.position);
		if (direction) this.aim = direction;
		const attack = this.kind.attacks[this.attackIndex];
		const distance = flatDistance(this.position, seen.position);
		if (now >= this.attackReadyAt && distance <= math.min(attack.range * 0.85, this.kind.sight)) {
			this.chainLeft = this.health < this.kind.health * this.kind.enrageBelow ? this.kind.chain : 1;
			return this.beginSwing(now);
		}

		const gap = distance - this.kind.preferredRange;
		if (!direction || math.abs(gap) < 1) this.destination = undefined;
		else this.destination = { x: this.position.x + direction.x * gap, z: this.position.z + direction.z * gap };
		return undefined;
	}

	private beginSwing(now: number): EnemyEvent {
		const swing: Swing = { attack: this.kind.attacks[this.attackIndex], origin: this.position, aim: this.aim };
		this.swing = swing;
		this.struck = false;
		this.chainLeft -= 1;
		this.destination = undefined;
		this.enter("Attack", now);
		return { kind: "telegraph", swing };
	}

	private updateAttack(now: number, target: Perception | undefined): EnemyEvent | undefined {
		const swing = this.swing;
		if (!swing) {
			this.enter("Chase", now);
			return undefined;
		}
		const elapsed = now - this.stateSince;
		if (!this.struck && elapsed >= swing.attack.windup) {
			this.struck = true;
			return { kind: "strike", swing };
		}
		if (!this.struck) return undefined;

		// O encadeamento pula a recuperação, mas cada golpe mantém o aviso inteiro.
		if (this.chainLeft > 0 && target) {
			const direction = flatDirection(this.position, target.position);
			if (direction) this.aim = direction;
			return this.beginSwing(now);
		}
		if (elapsed < swing.attack.windup + swing.attack.recover) return undefined;

		this.swing = undefined;
		this.attackIndex = (this.attackIndex + 1) % this.kind.attacks.size();
		this.attackReadyAt = now + this.kind.attackCooldown;
		this.enter("Chase", now);
		return undefined;
	}

	private enter(state: EnemyState, now: number) {
		this.state = state;
		this.stateSince = now;
	}
}
