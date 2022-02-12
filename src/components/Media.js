import React, { useRef } from 'react';

import Missing from './../img/missing.jpg';
import '../css/Features.scss';

export const Media = ({ media, classNames = [], useCanvas = false }) => {

	const ref = useCanvas ? useRef() : null;

	return <div className={[ 'media', ...classNames ].join(' ')}>

		{ useCanvas && <canvas ref={ref}></canvas> }
		
		<img
			style={{display: useCanvas ? 'none' : 'block'}}
			src={media ? media : Missing}
			onLoad={(e) => {
				if (!useCanvas) return;
				const image = e.target;
				const canvas = ref.current;
				canvas.width = image.width;
				canvas.height = image.height;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(image, 0, 0);
			}}
			onError={({ currentTarget }) => {
				if (currentTarget.src === Missing) {
					return;
				}
				currentTarget.onerror = null;
				currentTarget.src = Missing;
			}}
		/>

	</div>;
};