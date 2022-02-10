import React, { useState } from "react";
import { LineChart, Line, YAxis } from "recharts";
import { $brocolli, $lime, $brocolliAlpha } from '../utils/colors';

const width = Math.min(window.innerWidth - 32, 600 -32);
const height = width / 3;

const TIMES = [
	{ label: '1D', amount: 86400000 },
	{ label: '1W', amount: 604800000 },
	{ label: '1M', amount: 2592000000 },
	{ label: '6M', amount: 15552000000 },
	{ label: '1Y', amount: 31536000000 },
	{ label: 'ALL', amount: 0 },
];

import '../css/Chart.scss'

export const Chart = ({
	data,
	title = 'Average Price'
}) => {

	const [active, setActive] = useState(TIMES.length - 1);

	const filteredData = data.filter((data) => {
		if (active === TIMES.length - 1) return true;
		return Date.now() - TIMES[active].amount < data.updated_at; 
	});

	return (
		<div className="chart">
			<p>{ title }</p>
			{
				filteredData.length === 0
					?
					<div className="no-data" style={{ width, height }}>
						<p>No Data</p>
					</div>
					:
					<LineChart width={width} height={height} data={filteredData}>

						<defs>
							<linearGradient id="linear" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" stopColor={$brocolli} />
								<stop offset="50%" stopColor={$lime} />
								<stop offset="100%" stopColor={$brocolli} />
							</linearGradient>
						</defs>

						<YAxis dataKey="amount" stroke={$brocolliAlpha} mirror={true} orientation="right" />

						<Line type="monotone" dataKey="amount" stroke="url(#linear)" strokeWidth={2} dot={false} />
					</LineChart>
			}
			
			<div className="pills">
				{
					TIMES.map(({ label }, i) => <div
						key={i}
						className={['pill', i === active ? 'active' : ''].join(' ')}
						onClick={() => setActive(i)}
					>{label}</div>)
				}
			</div>
		</div>
	);
};
