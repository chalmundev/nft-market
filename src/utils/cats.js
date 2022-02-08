import { percent, near as format } from '../utils/format';

export const cats = [
	{ isToken: true, label: 'New Offers', key: 'new_offers', innerKey: 'amount', format },
	{ label: 'Gainers', key: 'high_change', innerKey: 'change', format: percent },
	{ isToken: true, label: 'Highest Tokens', key: 'high_sale_tokens', innerKey: 'amount', format },
	{ isToken: true, label: 'New Sales', key: 'new_sales', innerKey: 'amount', format },
	{ label: 'Top Volume', key: 'top_volume', innerKey: 'total' },
	{ label: 'Top Events', key: 'top_events', innerKey: 'total' },
	{ label: 'Highest Sellers', key: 'high_sales', innerKey: 'avg', format },
	{ label: 'Lowest Sellers', key: 'low_sales', innerKey: 'avg', format },
	{ isToken: true, label: 'Lowest Tokens', key: 'low_sale_tokens', innerKey: 'amount', format },
	{ label: 'Losers', key: 'low_change', innerKey: 'change', format: percent },
]