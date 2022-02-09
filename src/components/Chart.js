import * as React from "react";
import { LineChart, Line } from "recharts";
import { $brocolli, $lime } from '../utils/colors'

const width = Math.min(window.innerWidth - 32, 600)
const height = Math.min(window.innerWidth / 3, 200)

const data = [
	{
		name: "Page A",
		uv: 4000,
		pv: 2400,
		amt: 2400
	},
	{
		name: "Page B",
		uv: 3000,
		pv: 1398,
		amt: 2210
	},
	{
		name: "Page C",
		uv: 2000,
		pv: 9800,
		amt: 2290
	},
	{
		name: "Page D",
		uv: 2780,
		pv: 3908,
		amt: 2000
	},
	{
		name: "Page E",
		uv: 1890,
		pv: 4800,
		amt: 2181
	},
	{
		name: "Page F",
		uv: 2390,
		pv: 3800,
		amt: 2500
	},
	{
		name: "Page G",
		uv: 3490,
		pv: 4300,
		amt: 2100
	}
];

export const Chart = ({ data }) => {

	return (
		<div className="chart">
			<p>Average Price</p>
			<LineChart width={width} height={height} data={data}>

				<defs>
					<linearGradient id="linear" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor={$brocolli} />
						<stop offset="50%" stopColor={$lime} />
						<stop offset="100%" stopColor={$brocolli} />
					</linearGradient>
				</defs>

				<Line type="monotone" dataKey="amount" stroke="url(#linear)" strokeWidth={2} dot={false} />
			</LineChart>
			<div className="pills">
				<div className="pill active">1D</div>
				<div className="pill">1W</div>
				<div className="pill">1M</div>
				<div className="pill">3M</div>
				<div className="pill">6M</div>
				<div className="pill">1Y</div>
			</div>
		</div>
	);
}
