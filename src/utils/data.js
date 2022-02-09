import { near } from './format'

export const contractPriceHistory = (data) => {
	if (!data) return
	const prices = []
	Object.entries(data.tokens).map(([name, val]) => {
		val.offers.forEach(({ event, amount, updated_at }) => {
			if (event === 0) return
			prices.push({
				name,
				updated_at,
				amount: parseFloat(near(amount))
			})
		})
	})
	return prices.sort((a, b) => a.updated_at - b.updated_at)
}