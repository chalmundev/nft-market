import { formatNearAmount } from '../state/near';

export const percent = (change) => (change * 100).toFixed(2)
export const near = (amount) => formatNearAmount(amount, 4)