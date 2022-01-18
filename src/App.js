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

import { RouteOffersMaker } from './components/RouteOffersMaker';
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
		])
		update('loading', false)
	};
	useEffect(onMount, []);

	if (state.loading) return <p>Loading</p>

	/// let's go!

	const {
		wallet, account, data,
		data: {
			contracts, marketSummary,
			contractId, index, tokens, supply,
			offersMaker, offersTaker,
		}
	} = state;

	const showBackToken = /\/(token)/gi.test(window.location.pathname)
	const showBackContact = /\/(contract)/gi.test(window.location.pathname)

	console.log(contracts)

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
				{showBackToken || showBackContact ? <div><Link to="/" onClick={(e) => {
					e.preventDefault()
					if (showBackToken) {
						return navigate(window.location.pathname.split('/').slice(0, -1).join('/').replace('/token', '/contract'))
					}
					if (showBackContact) {
						update('data.index', 0)
					}
					navigate('/')
				}}>Back</Link></div> : <div></div>}
				{account && <div>{account.accountId}</div>}
			</div>

			<Routes>
				<Route path="/offers-maker" element={
					<RouteOffersMaker {...{ dispatch, update, account, index, offersMaker }} />
				} />

				<Route path="/contract/:contract_id" element={
					<RouteContract {...{ dispatch, update, data }} />
				} />

				<Route path="/token/:contract_id/:token_id" element={
					<RouteToken {...{ dispatch, update, tokens, data }} />
				} />

				<Route path="/" element={
					contracts.filter(({ contract_id, name }) => /loot/gi.test(name) || contract_id === 'tests.nft-market.testnet')
						.map(({ contract_id, ts, name }) => {
							return <div key={contract_id} onClick={() => navigate('/contract/' + contract_id)}>
								{name} - {contract_id} - {ts}
							</div>;
						})
				} />
			</Routes>

		</main>
	);
};

export default App;
