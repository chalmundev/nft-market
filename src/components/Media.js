import React from 'react';

import Missing from './../img/missing.jpg';
import '../css/Features.scss';

export const Media = ({ media }) => {

	return <div className='token-image'>

		<img
			src={media ? media : Missing}
			onError={({ currentTarget }) => {
				if (currentTarget.src === Missing) {
					return
				}
				currentTarget.onerror = null;
				currentTarget.src = Missing;
			}}
		/>

	</div>;
};