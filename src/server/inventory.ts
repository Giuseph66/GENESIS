import { Counts, INVENTORY_CAPACITY, ItemId, ITEMS } from "../shared/catalog";

/** Estoque com limite por item. Toda operação muda tudo ou nada. */
export class Inventory {
	private readonly items = new Map<ItemId, number>();

	constructor(private readonly capacity = INVENTORY_CAPACITY) {}

	public get(item: ItemId): number {
		return this.items.get(item) ?? 0;
	}

	public space(item: ItemId): number {
		return this.capacity - this.get(item);
	}

	public add(item: ItemId, amount: number): boolean {
		if (!Inventory.isAmount(amount) || amount > this.space(item)) return false;
		this.items.set(item, this.get(item) + amount);
		return true;
	}

	public remove(item: ItemId, amount: number): boolean {
		if (!Inventory.isAmount(amount) || amount > this.get(item)) return false;
		this.items.set(item, this.get(item) - amount);
		return true;
	}

	/** Recebe o conjunto inteiro ou nada. Quantidades zero são ignoradas. */
	public addAll(counts: Counts): boolean {
		for (const item of ITEMS) {
			const amount = counts[item.id] ?? 0;
			if (amount !== 0 && (!Inventory.isAmount(amount) || amount > this.space(item.id))) return false;
		}
		for (const item of ITEMS) {
			const amount = counts[item.id] ?? 0;
			if (amount !== 0) this.items.set(item.id, this.get(item.id) + amount);
		}
		return true;
	}

	/** Transfere para outro estoque sem criar nem perder itens. */
	public transfer(target: Inventory, item: ItemId, amount: number): boolean {
		if (target === this || !Inventory.isAmount(amount)) return false;
		if (amount > this.get(item) || amount > target.space(item)) return false;
		return this.remove(item, amount) && target.add(item, amount);
	}

	private static isAmount(amount: number): boolean {
		return amount > 0 && amount < math.huge && math.floor(amount) === amount;
	}
}
