import { near } from './format';

const fillPrices = (prices, name, all = false) => ({ event, amount, updated_at }) => {
	if (!all && event === 0) return;
	prices.push({
		name,
		updated_at: Math.floor(updated_at / 1000000),
		amount: parseFloat(near(amount, false))
	});
};

export const contractPriceHistory = (data) => {
	if (!data) return [];
	const prices = [];
	Object.entries(data.tokens).map(([name, val]) => val.offers.forEach(fillPrices(prices, name)));
	return prices.sort((a, b) => a.updated_at - b.updated_at);
};

export const tokenPriceHistory = (offers, all = false) => {
	if (!offers || offers.length === 0) return [];
	const prices = [];
	offers.forEach(fillPrices(prices, 'offer', all));
	return prices.sort((a, b) => a.updated_at - b.updated_at);
};