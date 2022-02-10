import React, { useState, useEffect } from 'react';

import { howLongAgo } from '../utils/date';
import { near, usd } from '../utils/format';

import '../css/Events.scss';
export const Events = ({ title, events }) => {

	return <div className='event-list'>
		<p className="title">{title}</p>
		{
			events.map(({ event, amount, maker_id, taker_id, updated_at }, i) => <div className="event" key={i}>
				<div>
					<div>{near(amount, true)}</div>
					<div>{maker_id}</div>
				</div>
				<div>
					<div>{usd(amount)}</div>
					<div>{howLongAgo({ ts: updated_at / (1000 * 1000), detail: 'minute' })}</div>
				</div>
			</div>)
		}
	</div>;
};