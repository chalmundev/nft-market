import React, { useContext, useEffect, useState } from 'react';
import {
	Routes,
	Route,
	Link,
	useParams,
	useNavigate,
} from "react-router-dom";

import { appStore, fetchContracts, fetchData } from './state/app';
import { initNear } from './state/near';
import { networkId } from './../utils/near-utils';

import { RouteMain } from './components/RouteMain';
import { RouteOffers } from './components/RouteOffers';
import { RouteContract } from './components/RouteContract';
import { RouteToken } from './components/RouteToken';

import './App.scss';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);

	// console.log(state)

	const navigate = useNavigate();

	const onMount = async () => {
		await Promise.all([
			dispatch(initNear()),
			dispatch(fetchData()),
			dispatch(fetchContracts()),
		]);
		update('loading', false);
	};
	useEffect(onMount, []);

	if (state.loading) return <p>Loading</p>;

	/// let's go!

	const {
		wallet, account, data,
		data: {
			contracts, 
			index, cache,
			offers, supply,
		}
	} = state;

	const showBackHome = /\/(maker|taker)/gi.test(window.location.pathname);
	const showBackToken = /\/(token)/gi.test(window.location.pathname);
	const showBackContact = /\/(contract)/gi.test(window.location.pathname);

	return (
		<main className="container-fluid">

			<nav>
				<ul>
					<li>
						<strong>Brand</strong>
					</li>
				</ul>
				<ul>
					<li>
						<Link to="/">Home</Link>
					</li>
					<li>
						<Link to="/offers/maker">My Offers</Link>
					</li>
					<li>
						<Link to="/offers/taker">Received</Link>
					</li>
					<li>
						{
							account
								?
								<Link to="/" onClick={() => wallet.signOut()}>Sign Out</Link>
								:
								<Link to="/" onClick={() => wallet.signIn()}>Sign In</Link>
						}
					</li>
				</ul>
			</nav>

			<div className='crumbs'>
				{showBackHome || showBackToken || showBackContact ? <div><Link to="/" onClick={(e) => {
					e.preventDefault();
					if (showBackToken) {
						return navigate(window.location.pathname.split('/').slice(0, -1).join('/').replace('/token', '/contract'));
					}
					if (showBackContact) {
						update('data.index', 0);
					}
					navigate('/');
				}}>Back</Link></div> : <div></div>}
				{account && <div><a href={`https://explorer.${networkId}.near.org/accounts/${account.accountId}`} target="_blank">{account.accountId}</a></div>}
			</div>

			<Routes>
				<Route path="/offers/maker" element={
					<RouteOffers {...{ dispatch, update, account, offers, index, supply, cache }} />
				} />

				<Route path="/offers/taker" element={
					<RouteOffers {...{ dispatch, update, account, offers, index, supply, cache }} />
				} />

				<Route path="/contract/:contract_id" element={
					<RouteContract {...{ dispatch, update, account, data }} />
				} />

				<Route path="/token/:contract_id/:token_id" element={
					<RouteToken {...{ dispatch, update, account, data }} />
				} />

				<Route path="/" element={
					<RouteMain {...{ contracts }} /> 
				} />
			</Routes>

		</main>
	);
};

export default App;
