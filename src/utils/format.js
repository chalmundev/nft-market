import React from 'react';
import { formatNearAmount } from '../state/near';
import { near2usd } from '../state/app';
import NearLogo from '../img/near-logo.svg';

export const percent = (change) => (change * 100).toFixed(2);
export const near = (amount, withLogo = false) => withLogo
	?
	<div className="near-amount">{formatNearAmount(amount, 4)}<img src={NearLogo} /></div>
	:
	formatNearAmount(amount, 4);

export const usd = (amount, rate) => '$' + Number(parseFloat(formatNearAmount(amount, 4)) * near2usd()).toFixed(2);