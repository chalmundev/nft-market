import React from 'react';

import Warning from '../img/warning.svg'
import Close from '../img/close.svg'

export const Modal = ({ update, message }) => {

	return <div className='modal' onClick={() => update('modal', null)}>
		<div>
			<div>
				<img src={Warning} />
				<img src={Close} />
			</div>
			<p>{ message }</p>
		</div>
	</div>;
};