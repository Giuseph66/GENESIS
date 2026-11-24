import { FighterState, PLAYER_ATTACKS, PLAYER_COMBAT, PlayerAttackId } from "./combat";

/** Resistência e recargas. O servidor decide; o cliente usa a mesma regra para prever. */
export class Fighter {
	private stamina = PLAYER_COMBAT.stamina;
	private updatedAt = 0;
	private regenAt = 0;
	private invulnerableUntil = 0;
	private shield = 0;
	private damageScale = 1;
	private cooldownScale = 1;
	private readonly readyAt = { primary: 0, secondary: 0, dodge: 0 };

	public attack(id: PlayerAttackId, now: number): boolean {
		if (now < this.readyAt[id]) return false;
		this.readyAt[id] = now + PLAYER_ATTACKS[id].cooldown * this.cooldownScale;
		return true;
	}

	public dodge(now: number): boolean {
		this.regenerate(now);
		if (now < this.readyAt.dodge || this.stamina < PLAYER_COMBAT.dodgeCost) return false;
		this.stamina -= PLAYER_COMBAT.dodgeCost;
		this.readyAt.dodge = now + PLAYER_COMBAT.dodgeCooldown;
		this.regenAt = now + PLAYER_COMBAT.regenDelay;
		this.invulnerableUntil = now + PLAYER_COMBAT.dodgeInvulnerable;
		return true;
	}

	public isInvulnerable(now: number): boolean {
		return now < this.invulnerableUntil;
	}

	public damage(id: PlayerAttackId): number {
		return PLAYER_ATTACKS[id].damage * this.damageScale;
	}

	/** Parte do dano que passa pelo escudo temporário. */
	public absorb(amount: number): number {
		const blocked = math.min(this.shield, math.max(0, amount));
		this.shield -= blocked;
		return amount - blocked;
	}

	/** Aplica uma melhoria da tentativa. Velocidade pertence a quem move o personagem. */
	public upgrade(effect: "damage" | "shield" | "recharge", amount: number) {
		if (effect === "damage") this.damageScale += amount;
		else if (effect === "shield") this.shield += amount;
		else this.cooldownScale *= 1 - amount;
	}

	public state(now: number): FighterState {
		this.regenerate(now);
		return {
			stamina: this.stamina,
			primary: math.max(0, this.readyAt.primary - now),
			secondary: math.max(0, this.readyAt.secondary - now),
			dodge: math.max(0, this.readyAt.dodge - now),
			shield: this.shield,
			damageScale: this.damageScale,
			cooldownScale: this.cooldownScale,
		};
	}

	/** Reconcilia a previsão do cliente com o estado do servidor. */
	public apply(state: FighterState, now: number) {
		this.regenerate(now);
		this.stamina = state.stamina;
		this.readyAt.primary = now + state.primary;
		this.readyAt.secondary = now + state.secondary;
		this.readyAt.dodge = now + state.dodge;
		this.shield = state.shield;
		this.damageScale = state.damageScale;
		this.cooldownScale = state.cooldownScale;
	}

	private regenerate(now: number) {
		const from = math.max(this.updatedAt, this.regenAt);
		if (now > from) {
			this.stamina = math.min(PLAYER_COMBAT.stamina, this.stamina + (now - from) * PLAYER_COMBAT.regenPerSecond);
		}
		this.updatedAt = math.max(this.updatedAt, now);
	}
}
