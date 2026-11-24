const workspace = game.GetService("Workspace");

function findPart(world: Instance, name: string): BasePart {
	const target = world.FindFirstChild(name);
	assert(target?.IsA("BasePart"), `Peça "${name}" ausente em ${world.GetFullName()}.`);
	return target;
}

/** Localiza as peças interativas da sala definida em assets/installation.model.json. */
export function getInstallation() {
	const world = workspace.FindFirstChild("GenesisInstallation");
	assert(world, "GenesisInstallation ausente no Workspace.");
	return {
		terminal: findPart(world, "TerminalEcho"),
		iron: findPart(world, "DepositoFerro"),
		coal: findPart(world, "DepositoCarvao"),
		maintenanceDoor: findPart(world, "Porta de manutenção"),
	};
}
