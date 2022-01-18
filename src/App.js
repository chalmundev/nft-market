import React, { useContext, useEffect } from 'react';
import {
	Routes,
	Route,
	Link,
	useParams,
	useNavigate,
} from "react-router-dom";

import data from '../static/data.json';
import { appStore, onAppMount } from './state/app';

import { RouteOffersMaker } from './components/RouteOffersMaker';
import { RouteContract } from './components/RouteContract';
import { RouteToken } from './components/RouteToken';

import './App.scss';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);

	// console.log('state', state);

	const navigate = useNavigate();

	const onMount = () => {
		dispatch(onAppMount());
	};
	useEffect(onMount, []);

	const {
		wallet, account,
		data: { 
			contractId, index, tokens, supply,
			offersMaker, offersTaker,
		}
	 } = state;

	const showBackToken = /\/(token)/gi.test(window.location.pathname)
	const showBackContact = /\/(contract)/gi.test(window.location.pathname)

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
				{ showBackToken || showBackContact ? <div><Link to="/" onClick={(e) => {
					e.preventDefault()
					if (showBackToken) {
						return navigate(window.location.pathname.split('/').slice(0, -1).join('/').replace('/token', '/contract'))
					}
					if (showBackContact) {
						update('data.index', 0)
					}
					navigate('/')
				}}>Back</Link></div> : <div></div> }
				{ account && <div>{account.accountId}</div> }
			</div>

			<Routes>
				<Route path="/offers-maker" element={
					<RouteOffersMaker {...{ dispatch, update, account, index, offersMaker }} />
				} />

				<Route path="/contract/:contract_id" element={
					<RouteContract {...{ dispatch, update, contractId, index, supply, tokens }} />
				} />

				<Route path="/token/:contract_id/:token_id" element={
					<RouteToken {...{ dispatch, tokens }} />
				} />

				<Route path="/" element={
					data
						.filter(({ contract_id, name }) => /loot/gi.test(name) || contract_id === 'tests.nft-market.testnet')
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
