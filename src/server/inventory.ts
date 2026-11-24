import { INVENTORY_CAPACITY, ResourceId } from "../shared/catalog";

/** Estoque com limite por recurso. Toda operação muda tudo ou nada. */
export class Inventory {
	private readonly items = new Map<ResourceId, number>();

	constructor(private readonly capacity = INVENTORY_CAPACITY) {}

	public get(resource: ResourceId): number {
		return this.items.get(resource) ?? 0;
	}

	public space(resource: ResourceId): number {
		return this.capacity - this.get(resource);
	}

	public add(resource: ResourceId, amount: number): boolean {
		if (!Inventory.isAmount(amount) || amount > this.space(resource)) return false;
		this.items.set(resource, this.get(resource) + amount);
		return true;
	}

	public remove(resource: ResourceId, amount: number): boolean {
		if (!Inventory.isAmount(amount) || amount > this.get(resource)) return false;
		this.items.set(resource, this.get(resource) - amount);
		return true;
	}

	/** Transfere para outro estoque sem criar nem perder itens. */
	public transfer(target: Inventory, resource: ResourceId, amount: number): boolean {
		if (target === this || !Inventory.isAmount(amount)) return false;
		if (amount > this.get(resource) || amount > target.space(resource)) return false;
		return this.remove(resource, amount) && target.add(resource, amount);
	}

	private static isAmount(amount: number): boolean {
		return amount > 0 && amount < math.huge && math.floor(amount) === amount;
	}
}
