import React, { useState } from 'react'
import {
	Link,
} from "react-router-dom";

export const Select = ({ active, options }) => {

	const { label } = active

	const [open, setOpen] = useState(false)

	return <div className='select' onClick={() => setOpen(!open)}>
		<div>
			<div>
				<div>{label}</div>
				<div className={open.toString()}>
					{
						options.map(({ label, key }) => <div key={key}>
							<Link to={`/summary/${key}`}>{label}</Link>
						</div>)
					}
				</div>
			</div>
		</div>
	</div>
}