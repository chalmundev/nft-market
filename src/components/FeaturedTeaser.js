import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { useSwipeable } from 'react-swipeable';
import anime from 'animejs';
import { parseData } from '../utils/media';
import { Media } from './Media';
import '../css/Features.scss';

/// items are tokens or contracts

const anim = {};

export const FeaturedTeaser = ({ contractMap, batch, data, items }) => {

	const [index, setIndex] = useState(0);
	const [titles, setTitles] = useState({});

	useEffect(() => {
		if (titles.title || !items.length) return;
		setTitles({ ...parseData(contractMap, batch, data[index], items[index]) });
	}, [items]);

	const update = (_index) => {
		setIndex(_index);
		anim?.title?.pause();
		anim?.slide?.pause();
		anim.title = anime({
			targets: '.titles',
			opacity: 0,
			duration: 320,
		});
		anim.slide = anime({
			targets: '.container',
			translateX: -_index * window.innerWidth,
			duration: 800,
			complete: () => {
				setTitles({ ...parseData(contractMap, batch, data[_index], items[_index]) });
				anime({
					targets: '.titles',
					opacity: 1,
					duration: 320,
				});
			}
		});
	};

	const handlers = useSwipeable({
		onSwiped: ({ dir }) => {
			let _index = index;
			if (dir === 'Right' && index > 0) _index--;
			if (dir === 'Left' && index+1 < items.length) _index++;
			if (_index !== index) update(_index);
		},
	});

	const handleSwipeClick = (e) => {
		let _index = index;
		if (e.clientX < window.innerWidth/2 && index > 0) _index--;
		if (e.clientX > window.innerWidth/2 && index+1 < items.length) _index++;
		if (_index !== index) update(_index);
	};

	const { title, subtitle } = titles;

	return <div className='featured-teaser' {...{...handlers, onClick: handleSwipeClick } }>

		<div>
			<div className="container">

				{
					items.map((item, i) => {
						const { link, media } = parseData(contractMap, batch, data[i], item);

						return <div key={i}>
							<Link to={link}>
								<Media {...{ media, classNames: ['featured'] }} />
							</Link>
						</div>;
					})
				}
				
			</div>
		</div>

		<div className="titles">
			<h2>{ title }</h2>
			<p>{ subtitle }</p>
		</div>

		<div className='pills'>
			{
				items.map((_, i) => <div key={i} className={index === i ? 'active' : ''}></div>)
			}
		</div>

	</div>;
};