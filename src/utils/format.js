import React from 'react';
import { formatNearAmount } from '../state/near';
import { near2usd } from '../state/app';
import NearLogo from '../img/near-logo.svg';

export const percent = (change) => (change * 100).toFixed(2) + ' %';
export const near = (amount, withLogo = true) => withLogo
	?
	<span className="near-amount"><span><span>{formatNearAmount(amount, 4)}</span><img src={NearLogo} /></span></span>
	:
	formatNearAmount(amount, 4);

export const usd = (amount, rate) => '$' + Number(parseFloat(formatNearAmount(amount, 4)) * near2usd()).toFixed(2);