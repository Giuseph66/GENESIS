const runService = game.GetService("RunService");

/** Ombro direito, com uma rotação extra somada à animação em curso. */
export interface Shoulder {
	/** Inclina o braço para a frente, em radianos. Zero deixa só a animação. */
	readonly lift: (angle: number) => void;
	readonly isAlive: () => boolean;
}

const known = new WeakMap<Model, Shoulder>();

/** Avatares novos usam AnimationConstraint; os antigos, Motor6D. Dois sistemas compartilham a junta. */
export function findShoulder(character: Model): Shoulder | undefined {
	const cached = known.get(character);
	if (cached && cached.isAlive()) return cached;

	const upper = character.FindFirstChild("RightUpperArm");
	const joint = upper?.FindFirstChild("RightShoulder") ?? character.FindFirstChild("Torso")?.FindFirstChild("Right Shoulder");
	if (!joint?.IsA("Motor6D") && !joint?.IsA("AnimationConstraint")) return undefined;

	const isModern = upper !== undefined;
	let lifted = 0;
	const isAlive = () => joint.IsDescendantOf(game);
	// O Animator escreve Transform a cada quadro, antes de Stepped. A soma não se acumula.
	const connection = runService.Stepped.Connect(() => {
		if (!isAlive()) return connection.Disconnect();
		if (lifted === 0) return;
		const turn = isModern ? CFrame.Angles(lifted, 0, 0) : CFrame.Angles(0, 0, lifted);
		joint.Transform = joint.Transform.mul(turn);
	});
	const shoulder: Shoulder = {
		lift: (angle) => {
			lifted = angle;
		},
		isAlive,
	};
	known.set(character, shoulder);
	return shoulder;
}

/** As juntas chegam junto do corpo, que pode vir em partes com streaming. */
export function waitShoulder(character: Model): Shoulder | undefined {
	for (let i = 0; i < 20; i++) {
		const found = findShoulder(character);
		if (found) return found;
		task.wait(0.25);
	}
	return undefined;
}
