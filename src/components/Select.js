import React, { useState } from 'react';
import {
	Link,
} from "react-router-dom";

export const Select = ({ active, options, onSelect }) => {

	const { label } = active;

	const [open, setOpen] = useState(false);

	return <div className='select' onClick={() => setOpen(!open)}>
		<div>
			<div>
				<div>{label}</div>
				<div className={open.toString()}>
					{
						options
							.filter(({ key }) => key !== active.key)
							.map(({ label, key }) => <Link key={key} to={`/summary/${key}`} onClick={onSelect}>
								{label}
							</Link>)
					}
				</div>
			</div>
		</div>
	</div>;
};